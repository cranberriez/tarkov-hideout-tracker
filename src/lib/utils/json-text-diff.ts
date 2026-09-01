export interface TextDiffSegment {
    text: string;
    changed: boolean;
}

export interface SideBySideDiffRow {
    left: TextDiffSegment[] | null;
    right: TextDiffSegment[] | null;
}

type LineOperation =
    | { type: "equal"; line: string }
    | { type: "remove"; line: string }
    | { type: "add"; line: string };

function stringify(value: unknown): string {
    return value === undefined ? "undefined" : JSON.stringify(value, null, 2);
}

function lineOperations(left: string[], right: string[]): LineOperation[] {
    const lengths = Array.from(
        { length: left.length + 1 },
        () => new Uint32Array(right.length + 1),
    );

    for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
        for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
            lengths[leftIndex][rightIndex] =
                left[leftIndex] === right[rightIndex]
                    ? lengths[leftIndex + 1][rightIndex + 1] + 1
                    : Math.max(
                          lengths[leftIndex + 1][rightIndex],
                          lengths[leftIndex][rightIndex + 1],
                      );
        }
    }

    const operations: LineOperation[] = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
        if (left[leftIndex] === right[rightIndex]) {
            operations.push({ type: "equal", line: left[leftIndex] });
            leftIndex += 1;
            rightIndex += 1;
        } else if (
            lengths[leftIndex + 1][rightIndex] >=
            lengths[leftIndex][rightIndex + 1]
        ) {
            operations.push({ type: "remove", line: left[leftIndex] });
            leftIndex += 1;
        } else {
            operations.push({ type: "add", line: right[rightIndex] });
            rightIndex += 1;
        }
    }
    while (leftIndex < left.length) {
        operations.push({ type: "remove", line: left[leftIndex] });
        leftIndex += 1;
    }
    while (rightIndex < right.length) {
        operations.push({ type: "add", line: right[rightIndex] });
        rightIndex += 1;
    }
    return operations;
}

function inlineSegments(left: string, right: string): [TextDiffSegment[], TextDiffSegment[]] {
    let prefixLength = 0;
    while (
        prefixLength < left.length &&
        prefixLength < right.length &&
        left[prefixLength] === right[prefixLength]
    ) {
        prefixLength += 1;
    }

    let suffixLength = 0;
    while (
        suffixLength < left.length - prefixLength &&
        suffixLength < right.length - prefixLength &&
        left[left.length - suffixLength - 1] === right[right.length - suffixLength - 1]
    ) {
        suffixLength += 1;
    }

    const sharedPrefix = left.slice(0, prefixLength);
    const leftChanged = left.slice(prefixLength, left.length - suffixLength || undefined);
    const rightChanged = right.slice(prefixLength, right.length - suffixLength || undefined);
    const sharedSuffix = suffixLength > 0 ? left.slice(-suffixLength) : "";

    const build = (changedText: string): TextDiffSegment[] =>
        [
            { text: sharedPrefix, changed: false },
            { text: changedText, changed: true },
            { text: sharedSuffix, changed: false },
        ].filter((segment) => segment.text.length > 0);

    return [build(leftChanged), build(rightChanged)];
}

export function buildSideBySideJsonDiff(leftValue: unknown, rightValue: unknown): SideBySideDiffRow[] {
    const operations = lineOperations(stringify(leftValue).split("\n"), stringify(rightValue).split("\n"));
    const rows: SideBySideDiffRow[] = [];

    for (let index = 0; index < operations.length; ) {
        const operation = operations[index];
        if (operation.type === "equal") {
            const segment = [{ text: operation.line, changed: false }];
            rows.push({ left: segment, right: segment });
            index += 1;
            continue;
        }

        const removed: string[] = [];
        const added: string[] = [];
        while (index < operations.length && operations[index].type !== "equal") {
            const changedOperation = operations[index];
            if (changedOperation.type === "remove") removed.push(changedOperation.line);
            if (changedOperation.type === "add") added.push(changedOperation.line);
            index += 1;
        }

        const rowCount = Math.max(removed.length, added.length);
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            const leftLine = removed[rowIndex];
            const rightLine = added[rowIndex];
            if (leftLine !== undefined && rightLine !== undefined) {
                const [leftSegments, rightSegments] = inlineSegments(leftLine, rightLine);
                rows.push({ left: leftSegments, right: rightSegments });
            } else {
                rows.push({
                    left:
                        leftLine === undefined
                            ? null
                            : [{ text: leftLine, changed: true }],
                    right:
                        rightLine === undefined
                            ? null
                            : [{ text: rightLine, changed: true }],
                });
            }
        }
    }

    return rows;
}
