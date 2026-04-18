"use client";

import React from "react";
import { Card } from "antd";
import ExpensesPanel from "./ExpensesPanel";

export default function ExpensesPage() {
  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <ExpensesPanel />
    </Card>
  );
}
