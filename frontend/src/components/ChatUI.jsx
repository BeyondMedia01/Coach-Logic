import React, { useEffect, useState } from 'react'

export default function ChatUI(){
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState([
    { id: 1, side: 'left', text: "Hi, I’m Coach Logic! My mission is to offer you personalized support and deliver actionable insights to help you reach your goals. To help me provide you with personalized recommendations, I would love to learn more about you and your business - < BO business name>" },
    { id: 2, side: 'right', text: 'Hello, and thank you.' }
  ])

  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        const np = p + 6
        if (np >= 100) {
          clearInterval(t)
          return 100
        }
        return np
      })
    }, 350)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="demo-shell" style={{display:'flex',flexDirection:'column',minHeight:'100vh',gap:0}}>
      <header className="topbar" style={{height:64, display:'flex', alignItems:'center', padding:'0 16px', background:'#f8f9fb', borderBottom:'1px solid #e5e7eb'}}>
        <div className="avatar" style={{width:34,height:34,borderRadius:'50%',background:'#e5e5e5',display:'inline-flex',alignItems:'center',justifyContent:'center',marginRight:8}}>👤</div>
        <div style={{fontWeight:600}}>Coach Logic</div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}} aria-label="build progress">
          <div style={{width:120, height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden'}}>
            <div style={{width: `${progress}%`, height: '100%', background:'#9ca3af'}} />
          </div>
          <span style={{fontSize:12, color:'#6b7280'}}>{progress}%</span>
        </div>
      </header>
      <main className="chat-area" style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 16px'}}>
        <div className="title" style={{fontWeight:700, marginBottom:12}}>Let's Get to know each other!</div>
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.side}`} style={{display:'flex', alignItems:'center', gap:8, maxWidth:520, padding:'12px 16px', borderRadius:12, margin:'6px 0', background: m.side==='left' ? '#eef0f2' : '#6e63f7', color: m.side==='left' ? '#111' : '#fff'}}>
            <span className="avatar-sm" style={{width:28,height:28,borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', background:'#ddd'}}>👤</span>
            <span style={{whiteSpace:'pre-wrap'}}>{m.text}</span>
          </div>
        ))}
      </main>
      <footer className="composer" style={{padding:'12px 16px', borderTop:'1px solid #eee', display:'flex', gap:8}}>
        <textarea placeholder="Message Coach logic..." rows={2} style={{flex:1, padding:12, borderRadius:12, border:'1px solid #e5e7eb'}} />
        <button className="send" style={{background:'#6e63f7', color:'#fff', border:'none', padding:'12px 16px', borderRadius:12}}>Send</button>
      </footer>
    </div>
  )
}
