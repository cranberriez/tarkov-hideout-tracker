// Grayscale FIR badge reference from the supplied stash screenshot (October 2026).
// This contains only the badge and its immediate background, not item identity.
const pixels = [
	"1d1f1e1f1e201f2122242426292a2d2d",
	"1f1e1f1e201f212123242626282a2c2f",
	"1e1f1e201e20202021242527292b2d2e",
	"201e201f201e252b2f2a252428292c2f",
	"1e1f1e20223c648283744c30324a432d",
	"1f1e20224f7e7f6868788c6d6b996c2f",
	"202020428e6e3c2d2e366496afa25a2f",
	"221f2c738441332723245ca6aa683031",
	"2220358b62658456335899a99d612a30",
	"2420388f575fa09b7c9c997b936d2932",
	"252236916b3a5ca6b99f535f95652b32",
	"25242f73934c2e5a7c593f858f462f33",
	"282829438e895e47515a849a63323334",
	"2a292929508ba1928e9da06a38303333",
	"2c2b2c2c2b41677c7e724f3431333434",
	"2c2e2e2f2e2f2e2e2f30303234333434",
].join("");
export const FIR_TEMPLATE = Array.from({ length: 256 }, (_, i) => parseInt(pixels.slice(i * 2, i * 2 + 2), 16));
