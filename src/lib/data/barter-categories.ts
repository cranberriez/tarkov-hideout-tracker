/**
 * Leaf categories under Tarkov's "Barter item" parent (5448eb774bdc2d0a728b4567): the items a
 * junk box accepts. Fuel sits under Lubricant. Catalog items keep only their leaf category.
 */
const BARTER_CATEGORY_IDS = new Set([
	"57864ee62459775490116fc1", // Battery
	"57864a66245977548f04a81f", // Electronics
	"57864e4c24597754843f8723", // Lubricant
	"5d650c3e815116009f6201d2", // Fuel
	"57864a3d24597754843f8721", // Jewelry
	"590c745b86f7743cc433c5f2", // Other
	"57864ada245977548638de91", // Building material
	"57864c322459775490116fbf", // Household goods
	"57864bb7245977548b3b66c2", // Tool
	"57864c8c245977548867e7f1", // Medical supplies
]);

export function isBarterCategory(categoryId: string | null | undefined): boolean {
	return !!categoryId && BARTER_CATEGORY_IDS.has(categoryId);
}
