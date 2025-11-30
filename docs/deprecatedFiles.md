# Deprecated Files and Paths

The following files are candidates for removal once all usages are fully migrated.
They are kept for now for reference and to avoid breaking changes.

-   **Other legacy data paths**
    -   Any components or utilities that depended on `useDataStore` for stations/items
        and have since been refactored to use `DataContext` only.
    -   When you identify them as unused, add them here before deleting for easier tracking.
