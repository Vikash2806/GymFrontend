"use client";

import { Card, Statistic, Row, Col } from "antd";

export default function DashboardPage() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card>
          <Statistic title="Total Members" value={128} />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Statistic title="Active Plans" value={63} />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Statistic title="Today's Check-ins" value={41} />
        </Card>
      </Col>
    </Row>
  );
}
