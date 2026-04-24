import { getActiveCities } from "@/utils/cityData";
import { getActiveCountries } from "@/utils/countryData";
import { getActiveStates } from "@/utils/stateData";

export type LocationLanguage = "en" | "ta";
export type OptionValueMode = "code" | "name";

export interface LocationOption {
  label: string;
  value: string;
}

export const getCountryOptions = (
  language: LocationLanguage = "en",
  valueMode: OptionValueMode = "name"
): LocationOption[] =>
  getActiveCountries().map((country) => ({
    label: country.names[language] || country.names.en,
    value: valueMode === "code" ? country.country_code : country.names.en
  }));

export const getStateOptions = (
  language: LocationLanguage = "en",
  countryCode?: string,
  valueMode: OptionValueMode = "name"
): LocationOption[] =>
  getActiveStates()
    .filter((state) => (countryCode ? state.country_code === countryCode : true))
    .map((state) => ({
      label: state.names[language] || state.names.en,
      value: valueMode === "code" ? state.state_code : state.names.en
    }));

export const getCityOptions = (
  language: LocationLanguage = "en",
  stateCode?: string,
  countryCode?: string,
  valueMode: OptionValueMode = "name"
): LocationOption[] =>
  getActiveCities()
    .filter((city) => (stateCode ? city.state_code === stateCode : true))
    .filter((city) => (countryCode ? city.country_code === countryCode : true))
    .map((city) => ({
      label: city.names[language] || city.names.en,
      value: valueMode === "code" ? city.city_code : city.names.en
    }));
