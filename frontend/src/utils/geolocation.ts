export type DetectedAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state?: string;
  state_district?: string;
  postcode?: string;
  country?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

type BigDataCloudResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  postcode?: string;
  countryName?: string;
};

function firstValue(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) || "";
}

async function reverseGeocodeNominatim(latitude: number, longitude: number): Promise<DetectedAddress | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as NominatimResponse;
  const address = payload.address;
  if (!address) return null;
  const street = firstValue(
    [address.house_number, address.road || address.pedestrian].filter(Boolean).join(" "),
    address.road,
    address.pedestrian,
    payload.display_name?.split(",")[0],
  );
  const city = firstValue(address.city, address.town, address.village, address.city_district);
  const state = firstValue(address.state, address.state_district, address.county);
  if (!street && !city) return null;
  return {
    addressLine1: street || city,
    addressLine2: firstValue(address.suburb, address.neighbourhood) || undefined,
    city: city || street,
    state: state || city,
    postalCode: address.postcode || "",
    country: address.country || "India",
    landmark: firstValue(address.suburb, address.neighbourhood) || undefined,
  };
}

async function reverseGeocodeBigDataCloud(latitude: number, longitude: number): Promise<DetectedAddress | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "en");
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const payload = (await response.json()) as BigDataCloudResponse;
  const city = firstValue(payload.city, payload.locality);
  if (!city && !payload.principalSubdivision) return null;
  return {
    addressLine1: firstValue(payload.locality, payload.city) || "Current location",
    city: city || firstValue(payload.principalSubdivision),
    state: firstValue(payload.principalSubdivision, city),
    postalCode: payload.postcode || "",
    country: payload.countryName || "India",
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<DetectedAddress> {
  try {
    const nominatim = await reverseGeocodeNominatim(latitude, longitude);
    if (nominatim) return nominatim;
  } catch {
    // Fall through to the browser-friendly provider.
  }
  const fallback = await reverseGeocodeBigDataCloud(latitude, longitude);
  if (!fallback) {
    throw new Error("Could not read an address for this location");
  }
  return fallback;
}

export function detectCurrentAddress(): Promise<DetectedAddress> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          resolve(await reverseGeocode(position.coords.latitude, position.coords.longitude));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Could not detect your current location"));
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied. Allow location access and try again."));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("Could not detect your location in time. Try again."));
          return;
        }
        reject(new Error("Unable to detect your current location"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
