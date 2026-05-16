"use client";

import { useState } from "react";
import { App, Button, Dropdown } from "antd";
import { DownOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
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

async function readApiErrorMessage(data: unknown): Promise<string | undefined> {
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { message?: string };
      return typeof parsed.message === "string" ? parsed.message : undefined;
    } catch {
      return undefined;
    }
  }
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
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
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const serverMessage = await readApiErrorMessage(error.response.data);
        if (status === 404) {
          message.error(serverMessage ?? "Export endpoint not found. Restart the API server and try again.");
        } else if (status === 403) {
          message.error(serverMessage ?? "You do not have permission to export this data.");
        } else {
          message.error(serverMessage ?? "Export failed.");
        }
      } else {
        message.error("Export failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dropdown
      menu={{
        items: [
          { key: "csv", label: "CSV" },
          { key: "xlsx", label: "Excel (.xlsx)" }
        ],
        onClick: ({ key }) => void runExport(key as ExportFormat)
      }}
      trigger={["click"]}
      disabled={disabled || loading}
    >
      <Button
        icon={<DownloadOutlined />}
        loading={loading}
        disabled={disabled}
      >
        {label} <DownOutlined />
      </Button>
    </Dropdown>
  );
}
