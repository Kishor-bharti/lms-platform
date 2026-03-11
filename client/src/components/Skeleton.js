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

/** Skeleton stack for Sessions / Classes card list */
export const SessionCardSkeleton = ({ count = 5 }) => (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', borderLeft: '4px solid #e8edf2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1, marginRight: 16 }}>
              <Bar w="55%" h={15} style={{ marginBottom: 8, borderRadius: 8 }} />
              <Bar w="35%" h={11} />
            </div>
            <Bar w={70} h={24} style={{ borderRadius: 20, flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Bar w={90} h={11} />
            <Bar w={60} h={28} style={{ borderRadius: 8, marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </div>
      ))}
    </div>
    <style>{SHIMMER_CSS}</style>
  </>
);

/** Skeleton grid for topic cards in SubjectStudent */
export const TopicCardSkeleton = ({ count = 6 }) => (
  <>
    <Row>
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} md="4" sm="6" className="mb-4">
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <Bar w={48} h={48} style={{ borderRadius: '50%', margin: '0 auto 14px' }} />
            <Bar w="65%" h={14} style={{ margin: '0 auto 8px', borderRadius: 8 }} />
            <Bar w="80%" h={10} style={{ margin: '0 auto 4px' }} />
            <Bar w="55%" h={10} style={{ margin: '0 auto' }} />
          </div>
        </Col>
      ))}
    </Row>
    <style>{SHIMMER_CSS}</style>
  </>
);

/** Skeleton grid for quiz / test-set cards */
export const QuizCardSkeleton = ({ count = 6 }) => (
  <>
    <Row>
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} lg="4" md="6" className="mb-4">
          <div style={{ background: '#fff', borderRadius: 12, borderTop: '4px solid #e8edf2', padding: '18px 18px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <Bar w="70%" h={15} style={{ marginBottom: 10, borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <Bar w={60} h={20} style={{ borderRadius: 20 }} />
              <Bar w={60} h={20} style={{ borderRadius: 20 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <Bar w="100%" h={40} style={{ borderRadius: 8 }} />
              <Bar w="100%" h={40} style={{ borderRadius: 8 }} />
            </div>
            <Bar w="100%" h={36} style={{ borderRadius: 8 }} />
          </div>
        </Col>
      ))}
    </Row>
    <style>{SHIMMER_CSS}</style>
  </>
);

/** Generic single-card page skeleton (QuizBuilder, QuizTaker intro) */
export const PageCardSkeleton = () => (
  <>
    <Row className="justify-content-center">
      <Col lg="8">
        <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <Bar w="50%" h={22} style={{ marginBottom: 12, borderRadius: 10 }} />
          <Bar w="75%" h={13} style={{ marginBottom: 6 }} />
          <Bar w="55%" h={13} style={{ marginBottom: 32 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[1,2,3,4].map(n => <Bar key={n} w="100%" h={60} style={{ borderRadius: 10 }} />)}
          </div>
          <Bar w="100%" h={46} style={{ borderRadius: 10 }} />
        </div>
      </Col>
    </Row>
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
