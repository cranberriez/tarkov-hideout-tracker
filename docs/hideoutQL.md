The below graphql query is a basic outline that returns a list of hideout stations and their requirements to level up.

```graphql
{
    hideoutStations(lang: en) {
        id
        name
        levels {
            itemRequirements {
                id
                item {
                    id
                    name
                    iconLink
                    gridImageLink
                }
                count
                quantity
                attributes {
                    type
                    name
                    value
                }
            }
        }
    }
}
```
