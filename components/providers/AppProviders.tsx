"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import ReduxProvider from "@/redux/ReduxProvider";
import { useAppSelector } from "@/redux/hooks";

type AppProvidersProps = Readonly<{ children: React.ReactNode }>;

function ThemeProviderWrapper({ children }: AppProvidersProps) {
  const mode = useAppSelector((state) => state.theme.mode);
  return (
    <ConfigProvider
      theme={{
        algorithm:
          mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ReduxProvider>
      <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
    </ReduxProvider>
  );
}
