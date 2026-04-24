// State data with multilingual support
export interface StateData {
    country_code: string;
    state_code: string;
    names: {
        en: string;
        ta: string;
    };
    is_active: boolean;
}

// State master data (Indian States and Union Territories)
export const stateMasterData: StateData[] = [
    { "country_code": "IN", "state_code": "AP", "names": { "en": "Andhra Pradesh", "ta": "ஆந்திரப் பிரதேசம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "AR", "names": { "en": "Arunachal Pradesh", "ta": "அருணாசலப் பிரதேசம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "AS", "names": { "en": "Assam", "ta": "அசாம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "BR", "names": { "en": "Bihar", "ta": "பீகார்" }, "is_active": true },
    { "country_code": "IN", "state_code": "CT", "names": { "en": "Chhattisgarh", "ta": "சத்தீஸ்கர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "GA", "names": { "en": "Goa", "ta": "கோவா" }, "is_active": true },
    { "country_code": "IN", "state_code": "GJ", "names": { "en": "Gujarat", "ta": "குஜராத்" }, "is_active": true },
    { "country_code": "IN", "state_code": "HR", "names": { "en": "Haryana", "ta": "ஹரியானா" }, "is_active": true },
    { "country_code": "IN", "state_code": "HP", "names": { "en": "Himachal Pradesh", "ta": "ஹிமாச்சலப் பிரதேசம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "JH", "names": { "en": "Jharkhand", "ta": "ஜார்கண்ட்" }, "is_active": true },
    { "country_code": "IN", "state_code": "KA", "names": { "en": "Karnataka", "ta": "கர்நாடகம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "KL", "names": { "en": "Kerala", "ta": "கேரளம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "MP", "names": { "en": "Madhya Pradesh", "ta": "மத்தியப் பிரதேசம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "MH", "names": { "en": "Maharashtra", "ta": "மகாராஷ்டிரா" }, "is_active": true },
    { "country_code": "IN", "state_code": "MN", "names": { "en": "Manipur", "ta": "மணிப்பூர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "ML", "names": { "en": "Meghalaya", "ta": "மேகாலயா" }, "is_active": true },
    { "country_code": "IN", "state_code": "MZ", "names": { "en": "Mizoram", "ta": "மிசோரம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "NL", "names": { "en": "Nagaland", "ta": "நாகாலாந்து" }, "is_active": true },
    { "country_code": "IN", "state_code": "OR", "names": { "en": "Odisha", "ta": "ஒடிசா" }, "is_active": true },
    { "country_code": "IN", "state_code": "PB", "names": { "en": "Punjab", "ta": "பஞ்சாப்" }, "is_active": true },
    { "country_code": "IN", "state_code": "RJ", "names": { "en": "Rajasthan", "ta": "ராஜஸ்தான்" }, "is_active": true },
    { "country_code": "IN", "state_code": "SK", "names": { "en": "Sikkim", "ta": "சிக்கிம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "TN", "names": { "en": "Tamil Nadu", "ta": "தமிழ்நாடு" }, "is_active": true },
    { "country_code": "IN", "state_code": "TS", "names": { "en": "Telangana", "ta": "தெலங்கானா" }, "is_active": true },
    { "country_code": "IN", "state_code": "TR", "names": { "en": "Tripura", "ta": "திரிபுரா" }, "is_active": true },
    { "country_code": "IN", "state_code": "UP", "names": { "en": "Uttar Pradesh", "ta": "உத்தரப் பிரதேசம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "UK", "names": { "en": "Uttarakhand", "ta": "உத்தரகாண்ட்" }, "is_active": true },
    { "country_code": "IN", "state_code": "WB", "names": { "en": "West Bengal", "ta": "மேற்கு வங்காளம்" }, "is_active": true },
    { "country_code": "IN", "state_code": "AN", "names": { "en": "Andaman and Nicobar Islands", "ta": "அண்டமான் மற்றும் நிக்கோபார் தீவுகள்" }, "is_active": true },
    { "country_code": "IN", "state_code": "CH", "names": { "en": "Chandigarh", "ta": "சண்டிகர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "DN", "names": { "en": "Dadra and Nagar Haveli and Daman and Diu", "ta": "தாத்ரா & நகர் ஹவேலி மற்றும் டாமன் & டையூ" }, "is_active": true },
    { "country_code": "IN", "state_code": "DL", "names": { "en": "Delhi", "ta": "டெல்லி" }, "is_active": true },
    { "country_code": "IN", "state_code": "JK", "names": { "en": "Jammu and Kashmir", "ta": "ஜம்மு மற்றும் காஷ்மீர்" }, "is_active": true },
    { "country_code": "IN", "state_code": "LA", "names": { "en": "Ladakh", "ta": "லடாக்" }, "is_active": true },
    { "country_code": "IN", "state_code": "LD", "names": { "en": "Lakshadweep", "ta": "லக்ஷதீவு" }, "is_active": true },
    { "country_code": "IN", "state_code": "PY", "names": { "en": "Puducherry", "ta": "புதுச்சேரி" }, "is_active": true }
];

// Function to get state data
export const getStateData = (): StateData[] => {
    return stateMasterData;
};

// Function to get active states only
export const getActiveStates = (): StateData[] => {
    return stateMasterData.filter(state => state.is_active === true);
};

// Function to get active states by country code
export const getActiveStatesByCountry = (countryCode: string): StateData[] => {
    return stateMasterData.filter(state => state.is_active === true && state.country_code === countryCode);
};

