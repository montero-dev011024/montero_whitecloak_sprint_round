"use client";

import styles from "@/lib/styles/segmentedCareerForm.module.scss";

interface Tip {
  heading: string;
  body: string;
}

interface FormTipsSidebarProps {
  tipsContent: Tip[];
  tipsBulbGradientId: string;
  tipsStarGradientId: string;
}

const FormTipsSidebar = ({
  tipsContent,
  tipsBulbGradientId,
  tipsStarGradientId,
}: FormTipsSidebarProps) => {
  return (
    <aside className={styles.secondaryColumn}>
      <div className={styles.tipsCard}>
        <div className={styles.tipsHeader}>
          <span className={styles.tipsBadge} aria-hidden="true">
            <svg className={styles.tipsIcon} viewBox="0 0 48 48" role="presentation" focusable="false">
              <defs>
                <linearGradient
                  id={tipsBulbGradientId}
                  x1="12"
                  y1="8"
                  x2="36"
                  y2="40"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#f9a8d4" />
                  <stop offset="0.5" stopColor="#c4b5fd" />
                  <stop offset="1" stopColor="#93c5fd" />
                </linearGradient>
                <linearGradient
                  id={tipsStarGradientId}
                  x1="34"
                  y1="10"
                  x2="42"
                  y2="20"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#c4b5fd" />
                  <stop offset="1" stopColor="#93c5fd" />
                </linearGradient>
              </defs>
              <path
                d="M24 6C16.82 6 11 11.82 11 19c0 4.82 2.65 8.97 6.57 11.16L18 33h12l-.57-2.84C31.35 27.97 34 23.82 34 19c0-7.18-5.82-13-13-13Z"
                fill="none"
                stroke={`url(#${tipsBulbGradientId})`}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 34h10"
                stroke={`url(#${tipsBulbGradientId})`}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M20.5 38h7"
                stroke={`url(#${tipsBulbGradientId})`}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M22 42h3.5"
                stroke={`url(#${tipsBulbGradientId})`}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M36 11.5 37.2 14l2.6.3-1.9 1.8.5 2.4-2.2-1.2-2.1 1.2.4-2.4-1.9-1.8 2.6-.3z"
                fill={`url(#${tipsStarGradientId})`}
                fillOpacity="0.9"
              />
              <path
                d="m41 18.2.6 1.3 1.4.1-1 1 .3 1.3-1.2-.7-1.2.7.3-1.3-1-1 1.4-.1z"
                fill={`url(#${tipsStarGradientId})`}
                fillOpacity="0.75"
              />
            </svg>
          </span>
          <span className={styles.tipsTitle}>Tips</span>
        </div>
        <div className={styles.tipsBody}>
          <ul className={styles.tipsList}>
            {tipsContent.map((tip) => (
              <li key={tip.heading}>
                <strong>{tip.heading}</strong>
                <span>{tip.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default FormTipsSidebar;

