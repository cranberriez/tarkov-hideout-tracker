# Hideout Tracker Overview

The Hideout Tracker helps track all items required to build and upgrade every Hideout station in Escape From Tarkov using data from the Tarkov.dev GraphQL API.

## Goals

-   **Track all requirements** for every Hideout station level.
-   **Simulate in-game progression** starting from an empty hideout (except stash level 1–4).
-   **Pool required items** across all current and future upgrades into a single checklist.
-   **Let users lock/hide stations** whose requirements they do not care about.
-   **Provide simple views**: a Hideout-focused view and an Item-focused checklist view.

## Core Concepts

-   **Station**
    A Hideout module (e.g., Lavatory, Generator, Gun Range) with multiple levels.

-   **Level**
    A specific level of a station (e.g., Lavatory level 2). Each level has item requirements.

-   **Item Requirement**
    An item, its quantity, and possible condition/attribute requirements that must be met to build/upgrade.

-   **Hidden Station**
    A station that the user has chosen to ignore in this tracker. Its item requirements are not included in pooled item counts unless explicitly shown.

-   **Cheap Items**
    Items that are inexpensive and easy to obtain on the flea market/traders. These can be hidden from the pooled checklist.

## Application State (Conceptual)

At a high level the app needs to maintain:

-   **Known Stations/Levels**

    -   Station id, name, and levels from Tarkov.dev.
    -   For each level: list of item requirements.

-   **User Progress**

    -   Current level per station (starting at 0 / unbuilt, except stash which starts at its chosen level).
    -   Whether each station is **hidden** or **visible**.

-   **User Filters / Toggles**
    -   View mode on the checklist page:
        -   **All items needed** (current + all future levels).
        -   **Next level only** (items for the next upgrade level of each station).
    -   **Show Hidden** vs **Hide Hidden** (whether to include hidden stations in pooled items).
    -   **Hide Cheap** toggle.

The rest of the documents describe how each page uses this state and which Tarkov.dev queries are needed.
