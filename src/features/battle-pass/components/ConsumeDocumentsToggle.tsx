import { Toggle } from "./ui/Toggle";

export function ConsumeDocumentsToggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<Toggle
			checked={checked}
			onChange={onChange}
			title="Deduct available documents from inventory when completing rewards."
		>
			Consume Docs from Inventory
		</Toggle>
	);
}
