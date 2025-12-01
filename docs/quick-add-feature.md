# Quick Add Items Feature

## Overview
The Quick Add Items feature allows users to quickly input items they just retrieved from a raid. It is accessible via a modal triggered from the Navbar.

## UI/UX Design

### Entry Point
- **Location**: Navbar.
- **Action**: "Add Items" button.
- **Behavior**: Opens a modal.

### Modal Structure
- **Header**: "Add the items you just got out of raid".
- **Content**: A list of item rows.
- **Footer/Actions**: A "Save" or "Add Items" button to commit the changes.

### Interaction
1.  **Initial State**: Header + One "Add Item" row (Plus symbol).
2.  **Add Item Row**:
    *   Click "+" -> turns to Input.
    *   Type "bolt" -> Fuzzy search "Bolt".
    *   Select "Bolt" -> Row transforms to "Selected Item Row".
    *   New "Add Item" row appears below.
3.  **Selected Item Row**:
    *   Left: Icon + Name.
    *   Right: Input (Non-FiR), Input (FiR), "X" button.
    *   Updating inputs updates the local state of that addition.
    *   Clicking "X" removes the row.
4.  **Commit**:
    *   "Add Items" button commits the counts to the user's inventory and closes the modal.

## Data Logic
- **Search**:
    - Normalize input: Lowercase, replace spaces with dashes.
    - Compare against `item.normalizedName`.
    - Also check `item.name`.
- **Validation**:
    - Show error if `items` data is empty.
    - Show error if search yields no results.

## Technical Implementation
- **State**: `useUIStore` (new) for modal visibility. Local state in Modal component for the list of items to add.
- **Component**: `QuickAddModal.tsx`.
- **Integration**: `Navbar` calls `useUIStore.getState().setQuickAddOpen(true)`.
