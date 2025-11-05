// // src/components/Sidebar.jsx
// import React from 'react';

// export default function Sidebar({ unit = 1, setUnit = () => {} }) {
//   return (
//     <aside className="side-bar" role="complementary" aria-label="Units sidebar">
//       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//         <div className="sidebar-title" style={{ color: '#fff' }}>Units</div>
//       </div>

//       <div style={{ marginTop: 8 }}>
//         <button className={`unit-btn ${unit === 1 ? 'active' : ''}`} onClick={() => setUnit(1)}>Unit 1</button>
//       </div>
//       <div>
//         <button className={`unit-btn ${unit === 2 ? 'active' : ''}`} onClick={() => setUnit(2)}>Unit 2</button>
//       </div>
//       <div>
//         <button className={`unit-btn ${unit === 3 ? 'active' : ''}`} onClick={() => setUnit(3)}>Unit 3</button>
//       </div>

//       <div style={{ flex: 1 }} />

//       <div className="footer-note">Select a unit to load its blend.</div>
//     </aside>
//   );
// }


// src/components/Sidebar.jsx
// src/components/Sidebar.jsx
import React from 'react';

export default function Sidebar({ unit = 1, setUnit = () => {} }) {
  const units = [1, 2, 3];

  return (
    <aside className="side-bar" role="navigation" aria-label="Units sidebar">
      <div className="sidebar-title" style={{ marginBottom: 6 }}>Units</div>

      {units.map(u => (
        <button
          key={u}
          className={`unit-btn ${unit === u ? 'active' : ''}`}
          onClick={() => setUnit(u)}
          aria-pressed={unit === u}
          style={{ width: '100%' }}
        >
          Unit {u}
        </button>
      ))}

      <div style={{ height: 8 }} />

      <small style={{ color: '#fff', fontSize: 11, opacity: 0.95, textAlign: 'center' }}>
        Switch unit to load saved snapshot
      </small>
    </aside>
  );
}

