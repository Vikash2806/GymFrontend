"use client";

import React from "react";
import { Modal } from "antd";

type DiscardChangesModalProps = {
  open: boolean;
  onDiscard: () => void;
  onCancel: () => void;
};

export function DiscardChangesModal({ open, onDiscard, onCancel }: DiscardChangesModalProps) {
  return (
    <Modal
      open={open}
      title="Discard changes?"
      onOk={onDiscard}
      onCancel={onCancel}
      okText="Discard"
      cancelText="Stay"
      zIndex={3000}
      maskClosable={false}
      destroyOnHidden
    >
      You have unsaved changes. If you leave now, those changes will be lost.
    </Modal>
  );
}
