"use client";

import { Col, ConfigProvider, Row, Typography, theme as antdTheme } from "antd";
import styles from "./auth.module.css";

const { Title, Paragraph, Text } = Typography;

type AuthScreenProps = {
  children: React.ReactNode;
  bullets: string[];
};

const authConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    fontSize: 16,
    fontSizeLG: 18,
    fontSizeHeading5: 22,
    colorText: "#f5f8ff",
    colorTextSecondary: "#c8d4ea",
    colorTextPlaceholder: "#8b97b8",
    colorBorder: "rgba(143, 160, 205, 0.28)",
    colorBgContainer: "rgba(20, 28, 51, 0.92)",
    colorBgElevated: "rgba(16, 22, 42, 0.95)",
    controlHeight: 48,
    controlHeightLG: 52,
    borderRadius: 10,
    lineHeight: 1.55
  },
  components: {
    Form: {
      labelFontSize: 15,
      labelColor: "#eef3ff",
      verticalLabelPadding: "0 0 10px",
      itemMarginBottom: 18
    },
    Input: {
      fontSize: 16,
      paddingBlock: 11,
      paddingInline: 14,
      activeBorderColor: "#5077ff",
      hoverBorderColor: "rgba(143, 160, 205, 0.45)"
    },
    Button: {
      fontSize: 16,
      controlHeight: 48,
      fontWeight: 600,
      borderRadius: 10
    },
    Typography: {
      titleMarginTop: "0.5em",
      titleMarginBottom: "0.35em"
    }
  }
};

export default function AuthScreen({ children, bullets }: AuthScreenProps) {
  return (
    <ConfigProvider theme={authConfig}>
      <div className={styles.authRoot}>
        <div className={styles.gridOverlay} aria-hidden />
        <Row className={styles.authRow} gutter={[0, 0]} align="stretch">
          <Col xs={24} xl={15} xxl={14} className={styles.leftCol}>
            <div className={styles.brandBlock}>
              <div className={styles.brandTopLine}>
                <span className={styles.brandIcon} aria-hidden />
                <Text strong className={styles.brandName}>
                  FitForge
                </Text>
                <Text className={styles.brandSubtle}>Business OS</Text>
              </div>
              <Paragraph className={styles.brandHelper}>Secure admin access</Paragraph>
            </div>

            <div className={styles.welcomeBlock}>
              <Title level={1} className={styles.heading}>
                Welcome to <span className={styles.headingAccent}>FitForge</span>
              </Title>
              <Paragraph className={styles.subHeading}>
                The all-in-one gym business OS for memberships, payments, and growth.
              </Paragraph>
              <ul className={styles.bulletList}>
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            <Paragraph className={styles.footerText}>
              No credit card required - Setup in under 24 hours
            </Paragraph>
          </Col>

          <Col xs={24} xl={9} xxl={10} className={styles.rightCol}>
            {children}
          </Col>
        </Row>
      </div>
    </ConfigProvider>
  );
}
