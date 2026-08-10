const hashTextToCoordinate = (text = "", base) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 10000;
  }

  return base + (hash / 10000) * 0.35;
};

const buildLocationPoint = (address = "", fallbackLng = 77.5946, fallbackLat = 12.9716) => ({
  address,
  location: {
    type: "Point",
    coordinates: [
      hashTextToCoordinate(address, fallbackLng),
      hashTextToCoordinate(address.split("").reverse().join(""), fallbackLat),
    ],
  },
});

module.exports = {
  buildLocationPoint,
};
