/**
 * Skeleton loaders — shimmer placeholders used while data is fetching.
 *
 * Exports:
 *   TableSkeleton      — replaces a <tbody> while a table loads
 *   StatValueSkeleton  — replaces a stat number in dashboard cards
 *   CourseCardSkeleton — 3-column grid of shimmer cards for AdminCourses
 */

import { Row, Col } from 'reactstrap';

const shimmerStyle = {
  background: 'linear-gradient(90deg, #e8edf2 25%, #f4f6f9 50%, #e8edf2 75%)',
  backgroundSize: '400% 100%',
  animation: 'skShimmer 1.4s ease infinite',
  borderRadius: 6,
};

const SHIMMER_CSS = `
  @keyframes skShimmer {
    0%   { background-position: 100% 50%; }
    100% { background-position: -100% 50%; }
  }
`;

const Bar = ({ w = '100%', h = 13, style: extra = {} }) => (
  <div style={{ ...shimmerStyle, width: w, height: h, ...extra }} />
);

/** Skeleton that replaces a data table's tbody while loading */
export const TableSkeleton = ({ cols = 5, rows = 6 }) => (
  <>
    <tbody>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} style={{ borderBottom: '1px solid #f0f4f8' }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} style={{ padding: '14px 14px' }}>
              <Bar
                w={ci === 0 ? '60%' : ci === cols - 1 ? '40%' : `${55 + ((ri + ci) % 4) * 10}%`}
                h={12}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
    <style>{SHIMMER_CSS}</style>
  </>
);

/** Skeleton for a single dashboard stat card value */
export const StatValueSkeleton = () => (
  <>
    <Bar w={56} h={26} style={{ borderRadius: 8 }} />
    <style>{SHIMMER_CSS}</style>
  </>
);

/** Skeleton grid for AdminCourses card layout */
export const CourseCardSkeleton = ({ count = 6 }) => (
  <>
    <Row>
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} lg="4" md="6" className="mb-4">
          <div style={{ borderRadius: 14, border: '1px solid #e8edf2', padding: 20, background: '#fff' }}>
            <Bar w="70%" h={16} style={{ marginBottom: 12, borderRadius: 8 }} />
            <Bar w="90%" h={11} style={{ marginBottom: 6 }} />
            <Bar w="60%" h={11} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Bar w={64} h={24} style={{ borderRadius: 20 }} />
              <Bar w={64} h={24} style={{ borderRadius: 20 }} />
            </div>
            <Bar w="100%" h={34} style={{ borderRadius: 10 }} />
          </div>
        </Col>
      ))}
    </Row>
    <style>{SHIMMER_CSS}</style>
  </>
);
