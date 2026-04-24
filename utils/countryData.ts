// Country data with multilingual support
export interface CountryData {
    country_code: string;
    names: {
        en: string;
        ta: string;
    };
    is_active: boolean;
}

// Country master data
export const countryMasterData: CountryData[] = [
    {
        country_code: "IN",
        names: {
            en: "India",
            ta: "இந்தியா"
        },
        is_active: true
    },
    {
        country_code: "US",
        names: {
            en: "United States",
            ta: "ஐக்கிய அமெரிக்கா"
        },
        is_active: true
    },
    {
        country_code: "GB",
        names: {
            en: "United Kingdom",
            ta: "ஐக்கிய இராச்சியம்"
        },
        is_active: true
    }
];

// Function to get country data
export const getCountryData = (): CountryData[] => {
    return countryMasterData;
};

// Function to get active countries only
export const getActiveCountries = (): CountryData[] => {
    return countryMasterData.filter(country => country.is_active === true);
};

