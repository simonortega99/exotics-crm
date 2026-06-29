import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MESES, today } from '../lib/utils.js'

// Calendario mensual reutilizable.
// events: [{ id, date:'YYYY-MM-DD', label, tone }]
// onSelectDay(dateStr), onEventClick(id)
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Calendar({ events = [], selectedDate, onSelectDay, onEventClick }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const byDay = useMemo(() => {
    const map = {}
    events.forEach(e => { (map[e.date] = map[e.date] || []).push(e) })
    return map
  }, [events])

  const firstDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7 // Lunes = 0
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const move = delta => {
    const m = cursor.m + delta
    setCursor({ y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 })
  }
  const goToday = () => setCursor({ y: now.getFullYear(), m: now.getMonth() })
  const td = today()

  return (
    <div>
      <div className="cal-head">
        <div className="cal-nav">
          <button className="btn icon" onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
          <span className="cal-month">{MESES[cursor.m]} {cursor.y}</span>
          <button className="btn icon" onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        </div>
        <button className="btn sm" onClick={goToday}>Hoy</button>
      </div>

      <div className="cal-grid" style={{ marginBottom: 8 }}>
        {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={'e' + i} className="cal-cell empty" />
          const date = iso(cursor.y, cursor.m, d)
          const dayEvents = byDay[date] || []
          const cls = ['cal-cell', date === td ? 'today' : '', date === selectedDate ? 'selected' : ''].filter(Boolean).join(' ')
          return (
            <div key={date} className={cls} onClick={() => onSelectDay && onSelectDay(date)}>
              <div className="cal-daynum">{d}</div>
              {dayEvents.slice(0, 3).map(e => (
                <div key={e.id} className={`cal-chip ${e.tone || ''}`} title={e.label}
                  onClick={ev => { if (onEventClick) { ev.stopPropagation(); onEventClick(e.id) } }}>
                  {e.label}
                </div>
              ))}
              {dayEvents.length > 3 && <div className="cal-more">+{dayEvents.length - 3} más</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
