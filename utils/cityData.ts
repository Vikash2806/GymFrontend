// City data with multilingual support
export interface CityData {
    country_code: string;
    state_code: string;
    city_code: string;
    names: {
        en: string;
        ta: string;
    };
    is_active: boolean;
}

// City master data
export const cityMasterData: CityData[] = [
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_CHN", "names": { "en": "Chennai", "ta": "சென்னை" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_CBE", "names": { "en": "Coimbatore", "ta": "கோயம்புத்தூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_MDU", "names": { "en": "Madurai", "ta": "மதுரை" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TRY", "names": { "en": "Tiruchirappalli", "ta": "திருச்சிராப்பள்ளி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_SLM", "names": { "en": "Salem", "ta": "சேலம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TUP", "names": { "en": "Tiruppur", "ta": "திருப்பூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TNJ", "names": { "en": "Thanjavur", "ta": "தஞ்சாவூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_VLR", "names": { "en": "Vellore", "ta": "வேலூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_ERD", "names": { "en": "Erode", "ta": "ஈரோடு" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_DGL", "names": { "en": "Dindigul", "ta": "திண்டுக்கல்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TVL", "names": { "en": "Tirunelveli", "ta": "திருநெல்வேலி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TUT", "names": { "en": "Thoothukudi", "ta": "தூத்துக்குடி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_NGL", "names": { "en": "Nagercoil", "ta": "நாகர்கோவில்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_KUM", "names": { "en": "Kumbakonam", "ta": "கும்பகோணம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_CUD", "names": { "en": "Cuddalore", "ta": "கடலூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_KAR", "names": { "en": "Karur", "ta": "கரூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_NAM", "names": { "en": "Namakkal", "ta": "நாமக்கல்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_RMM", "names": { "en": "Ramanathapuram", "ta": "ராமநாதபுரம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_SIV", "names": { "en": "Sivakasi", "ta": "சிவகாசி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_PDY", "names": { "en": "Pudukkottai", "ta": "புதுக்கோட்டை" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_DHR", "names": { "en": "Dharmapuri", "ta": "தர்மபுரி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_KRI", "names": { "en": "Krishnagiri", "ta": "கிருஷ்ணகிரி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_VNR", "names": { "en": "Virudhunagar", "ta": "விருதுநகர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TNK", "names": { "en": "Tenkasi", "ta": "தென்காசி" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_ARI", "names": { "en": "Ariyalur", "ta": "அரியலூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_MAY", "names": { "en": "Mayiladuthurai", "ta": "மயிலாடுதுறை" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TVR", "names": { "en": "Tiruvarur", "ta": "திருவாரூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_KAN", "names": { "en": "Kanchipuram", "ta": "காஞ்சிபுரம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_CHG", "names": { "en": "Chengalpattu", "ta": "செங்கல்பட்டு" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "city_code": "TN_TPT", "names": { "en": "Tirupattur", "ta": "திருப்பத்தூர்" }, "is_active": true }
];

// Function to get city data
export const getCityData = (): CityData[] => {
    return cityMasterData;
};

// Function to get active cities only
export const getActiveCities = (): CityData[] => {
    return cityMasterData.filter(city => city.is_active === true);
};

// Function to get active cities by country code
export const getActiveCitiesByCountry = (countryCode: string): CityData[] => {
    return cityMasterData.filter(city => city.is_active === true && city.country_code === countryCode);
};

// Function to get active cities by state code
export const getActiveCitiesByState = (stateCode: string): CityData[] => {
    return cityMasterData.filter(city => city.is_active === true && city.state_code === stateCode);
};

// Function to get active cities by country and state code
export const getActiveCitiesByCountryAndState = (countryCode: string, stateCode: string): CityData[] => {
    return cityMasterData.filter(city => 
        city.is_active === true && 
        city.country_code === countryCode && 
        city.state_code === stateCode
    );
};

// Function to get city name by city code
export const getCityNameByCode = (cityCode: string, language: 'en' | 'ta' = 'ta'): string => {
    const city = cityMasterData.find(c => c.city_code === cityCode && c.is_active === true);
    if (city) {
        return city.names[language] || city.names.ta;
    }
    return cityCode; // Return code if city not found
};

