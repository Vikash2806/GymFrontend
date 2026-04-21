"use client";

import { useState } from "react";
import { App, Button, Dropdown, Space } from "antd";
import { DownOutlined, DownloadOutlined } from "@ant-design/icons";
import apiClient from "@/utils/api";

type ExportFormat = "csv" | "xlsx";

type ExportButtonProps = {
  endpoint: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  defaultFilename: string;
  label?: string;
  disabled?: boolean;
};

function filenameFromHeader(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf?.[1]) {
    return decodeURIComponent(utf[1]);
  }
  const plain = /filename="?([^"]+)"?/i.exec(value);
  return plain?.[1] ?? null;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function fallbackFilename(defaultFilename: string, format: ExportFormat): string {
  if (/\.(csv|xlsx)$/i.test(defaultFilename)) {
    return defaultFilename.replace(/\.(csv|xlsx)$/i, `.${format}`);
  }
  return `${defaultFilename}.${format}`;
}

export default function ExportButton({
  endpoint,
  params,
  defaultFilename,
  label = "Export",
  disabled
}: ExportButtonProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");

  const runExport = async (selectedFormat: ExportFormat) => {
    setLoading(true);
    try {
      const response = await apiClient.get<Blob>(endpoint, {
        params: { ...params, format: selectedFormat },
        responseType: "blob"
      });
      const contentType = String(response.headers["content-type"] ?? "");
      const isCsv = contentType.includes("text/csv");
      const isXlsx = contentType.includes(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      if (!isCsv && !isXlsx) {
        const maybeMessage = await response.data.text().catch(() => "");
        if (maybeMessage) {
          try {
            const parsed = JSON.parse(maybeMessage) as { message?: string };
            if (parsed.message) {
              message.error(parsed.message);
              return;
            }
          } catch {
            // Ignore non-JSON body.
          }
        }
        message.error("Export failed.");
        return;
      }
      const filename =
        filenameFromHeader(response.headers["content-disposition"]) ??
        fallbackFilename(defaultFilename, selectedFormat);
      triggerDownload(response.data, filename);
      message.success("Export downloaded.");
    } catch (error: unknown) {
      const status =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { status?: number; data?: { message?: string } } }).response?.status
          : undefined;
      const serverMessage =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      if (status === 404) {
        message.error(serverMessage ?? "Export endpoint not found. Refresh and try again.");
      } else {
        message.error(serverMessage ?? "Export failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space.Compact>
      <Button
        icon={<DownloadOutlined />}
        loading={loading}
        onClick={() => void runExport(format)}
        disabled={disabled}
      >
        {label} ({format.toUpperCase()})
      </Button>
      <Dropdown
        menu={{
          items: [
            { key: "csv", label: "CSV" },
            { key: "xlsx", label: "Excel (.xlsx)" }
          ],
          onClick: ({ key }) => setFormat(key as ExportFormat)
        }}
        trigger={["click"]}
      >
        <Button disabled={disabled}>
          <DownOutlined />
        </Button>
      </Dropdown>
    </Space.Compact>
  );
}
