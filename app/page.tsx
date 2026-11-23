'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { CellState, Difficulty, LEVELS, Puzzle } from '@/lib/types';

type Screen = 'home' | 'guide' | 'levels' | 'game' | 'result';
type Tool = 1 | 2;

const icons: Record<Difficulty, React.ReactNode> = {
  beginner: <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 54V28M32 35C20 34 14 26 13 16c12-1 21 5 23 15M32 29c3-11 11-17 22-16 0 12-7 20-19 21"/></svg>,
  novice: <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="15" y="10" width="36" height="45" rx="5"/><path d="M23 8v9M33 8v9M43 8v9M23 28h20M23 37h20M23 46h13"/></svg>,
  skilled: <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="13" width="48" height="34" rx="4"/><path d="M4 53h56M22 53l3-6h14l3 6M16 22h14v14H16zM35 22h13M35 29h13M35 36h9"/></svg>,
  advanced: <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 53 26 21l10 17 7-11 14 26H7Z"/><path d="M27 21V8l18 6-18 6"/></svg>,
  expert: <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 13h34v10c0 12-7 21-17 21S15 35 15 23V13Z"/><path d="M15 18H8v5c0 8 5 13 12 13M49 18h7v5c0 8-5 13-12 13M32 44v8M21 56h22"/></svg>
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [grid, setGrid] = useState<CellState[][]>([]); const [tool, setTool] = useState<Tool>(1);
  const [history, setHistory] = useState<CellState[][][]>([]); const [seconds, setSeconds] = useState(0);
  const [answerName, setAnswerName] = useState(''); const [bestTime, setBestTime] = useState<number|null>(null);
  const [drag, setDrag] = useState(false); const dragValue = useRef<CellState>(1);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    const number = Number(new URLSearchParams(window.location.search).get('puzzle'));
    if (!Number.isInteger(number) || number < 1) return;
    setLoading(true); setNotice('공유 문제를 불러오는 중입니다.');
    supabase.rpc('get_puzzle_by_number', { target_puzzle_no: number }).then(({ data, error }) => {
      setLoading(false);
      if (error || !data?.[0]) { setScreen('levels'); setNotice('공유된 문제를 찾을 수 없어요.'); return; }
      const selected = data[0] as Puzzle;
      setPuzzle(selected); setGrid(Array.from({length:selected.rows},()=>Array(selected.cols).fill(0)));
      setHistory([]); setSeconds(0); setAnswerName(''); setBestTime(null); setNotice(''); setScreen('game');
    });
  }, [supabase]);
  useEffect(() => {
    if (screen !== 'game') return;
    const id = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [screen]);
  useEffect(() => {
    const up = () => setDrag(false); window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up);
  }, []);

  const formatTime = (s:number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const formatNo = (n:number) => `#${String(n).padStart(6,'0')}`;
  const isMobile = () => window.matchMedia('(max-width:767px) and (pointer:coarse)').matches;

  async function authSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setNotice('');
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) return setNotice(result.error.message);
    setNotice(authMode === 'signup' && !result.data.session ? '인증 메일을 확인해 주세요.' : '로그인되었습니다.');
    if (result.data.session) setTimeout(() => setLoginOpen(false), 500);
  }

  async function loadPuzzle(level: Difficulty) {
    if (level === 'expert' && isMobile()) return setNotice('초고수 난이도는 PC에서만 플레이할 수 있어요.');
    setLoading(true); setNotice('문제를 불러오는 중입니다.');
    const { data, error } = await supabase.rpc('get_random_puzzle', { target_difficulty: level, target_user_id: user?.id ?? null });
    setLoading(false);
    if (error) return setNotice(`문제를 불러오지 못했어요: ${error.message}`);
    const selected = data?.[0] as Puzzle | undefined;
    if (!selected) return setNotice('아직 이 난이도에 등록된 문제가 없어요.');
    setPuzzle(selected); setGrid(Array.from({length:selected.rows},()=>Array(selected.cols).fill(0)));
    setHistory([]); setSeconds(0); setAnswerName(''); setBestTime(null); setNotice(''); setScreen('game');
  }

  function setCell(r:number,c:number,value:CellState) {
    setGrid(prev => {
      if (prev[r][c] === value) return prev;
      setHistory(h => [...h.slice(-49), prev.map(row=>[...row])]);
      return prev.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?value:cell)) as CellState[][];
    });
  }
  function pointerDown(r:number,c:number) { const v:CellState = grid[r][c]===tool?0:tool; dragValue.current=v; setDrag(true); setCell(r,c,v); }
  function undo() { const last=history.at(-1); if(last){setGrid(last);setHistory(h=>h.slice(0,-1));} }

  async function submitAnswer() {
    if(!puzzle) return; setLoading(true); setNotice('정답을 확인하는 중입니다.');
    const solution = grid.map(row=>row.map(c=>c===1?1:0));
    const call = user
      ? supabase.rpc('complete_puzzle',{target_puzzle_id:puzzle.id,submitted_solution:solution,submitted_elapsed_seconds:seconds,submitted_mistakes:0})
      : supabase.rpc('check_puzzle_answer',{target_puzzle_id:puzzle.id,submitted_solution:solution});
    const {data,error}=await call; setLoading(false);
    if(error) return setNotice(error.message);
    const result=data?.[0];
    if(!result?.correct) return setNotice('아직 맞지 않는 칸이 있어요. 다시 확인해보세요.');
    setAnswerName(result.answer_name); setBestTime(result.best_time_seconds ?? null); setNotice(''); setScreen('result');
  }

  async function sharePuzzle() {
    if(!puzzle) return;
    const url=`${location.origin}/?puzzle=${puzzle.puzzle_no}`;
    const text=`월루로직 ${formatNo(puzzle.puzzle_no)}에 도전해보세요.`;
    try { if(navigator.share) await navigator.share({title:'월루로직',text,url}); else {await navigator.clipboard.writeText(url);setNotice('문제 링크를 복사했어요.');} } catch {}
  }

  return <main className="shell">
    <header className="topbar"><button className="wordmark" onClick={()=>setScreen('home')}>월루로직</button><div>{user?<><span className="userMail">{user.email}</span><button className="subtle" onClick={()=>supabase.auth.signOut()}>로그아웃</button></>:<button className="subtle" onClick={()=>setLoginOpen(true)}>로그인</button>}</div></header>

    {screen==='home' && <section className="home screen">
      <div className="heroArt" aria-hidden="true"><svg viewBox="0 0 440 290"><g className="paper"><rect x="60" y="37" width="246" height="212" rx="18"/><path d="M109 37v212M158 37v212M207 37v212M256 37v212M60 79h246M60 121h246M60 163h246M60 205h246"/><path className="fill" d="M109 79h49v42h-49zM158 79h49v42h-49zM207 121h49v42h-49zM158 163h49v42h-49z"/></g><g className="pencil"><path d="m285 207 88-134 34 23-89 134-45 18Z"/><path d="m285 207 33 23-45 18Z"/></g></svg></div>
      <div className="title"><h1>월루로직</h1><p>NONOGRAM</p></div>
      <button className="primary" onClick={()=>setScreen('guide')}>월루 시작 <span>→</span></button>
    </section>}

    {screen==='guide' && <section className="guide screen"><button className="close" aria-label="닫기" onClick={()=>setScreen('levels')}>×</button><p className="eyebrow">HOW TO PLAY</p><h2>네모로직, 이렇게 풀어요</h2><div className="steps">
      <article><b>1</b><div><h3>숫자 힌트를 확인하세요</h3><p>각 행과 열의 숫자는 연속해서 채워야 하는 칸의 개수예요.</p></div></article>
      <article><b>2</b><div><h3>칸을 채우거나 X로 표시하세요</h3><p>숫자에 해당하는 칸은 채우고, 비어 있다고 판단한 칸은 X로 표시해요.</p><div className="states"><i className="filled"/><span>→</span><i className="cross">×</i><span>→</span><i/></div></div></article>
      <article><b>3</b><div><h3>모든 조건을 맞추면 완료</h3><p>행과 열의 조건을 모두 맞추면 숨겨진 그림이 공개돼요.</p></div></article>
    </div><button className="primary" onClick={()=>setScreen('levels')}>확인했어요</button></section>}

    {screen==='levels' && <section className="levels screen"><button className="back" onClick={()=>setScreen('home')}>←</button><h2>난이도를 선택하세요</h2><div className="levelList">{(Object.keys(LEVELS) as Difficulty[]).map(key=>{const l=LEVELS[key];return <button key={key} className={`levelCard ${l.pcOnly?'expert':''}`} onClick={()=>loadPuzzle(key)} disabled={loading}><span className="levelIcon">{icons[key]}</span><span><b>{l.title}</b><small>{l.description}</small>{l.pcOnly&&<em>PC 전용</em>}</span><strong>›</strong></button>})}</div><p className="notice" aria-live="polite">{notice}</p></section>}

    {screen==='game' && puzzle && <section className="game screen"><div className="gameHead"><button className="back" onClick={()=>setScreen('levels')}>←</button><div><b>{formatNo(puzzle.puzzle_no)}</b><small>{LEVELS[puzzle.difficulty].title}</small></div><time>{formatTime(seconds)}</time></div>
      <div className="boardScroll"><div className="boardWrap" style={{'--rows':puzzle.rows,'--cols':puzzle.cols} as React.CSSProperties}><div/><div className="colHints">{puzzle.column_hints.map((h,i)=><div key={i}>{h.map((n,j)=><span key={j}>{n}</span>)}</div>)}</div><div className="rowHints">{puzzle.row_hints.map((h,i)=><div key={i}>{h.map((n,j)=><span key={j}>{n}</span>)}</div>)}</div><div className="board" onContextMenu={e=>e.preventDefault()}>{grid.map((row,r)=>row.map((cell,c)=><button type="button" aria-label={`${r+1}행 ${c+1}열`} key={`${r}-${c}`} className={`cell ${cell===1?'filled':cell===2?'cross':''}`} onPointerDown={e=>{e.preventDefault();pointerDown(r,c)}} onPointerEnter={()=>drag&&setCell(r,c,dragValue.current)}/>))}</div></div></div>
      <div className="tools"><button className={tool===1?'active':''} onClick={()=>setTool(1)}><i className="toolFill"/>채우기</button><button className={tool===2?'active':''} onClick={()=>setTool(2)}><i className="toolX">×</i>X 표시</button><button onClick={undo}>↶ 실행취소</button></div>
      <p className="notice" aria-live="polite">{notice}</p><button className="primary" onClick={submitAnswer} disabled={loading}>{loading?'확인 중':'정답 확인'}</button>
    </section>}

    {screen==='result' && puzzle && <section className="result screen"><div className="completedGrid" style={{gridTemplateColumns:`repeat(${puzzle.cols},1fr)`}}>{grid.flat().map((c,i)=><i key={i} className={c===1?'on':''}/>)}</div><p className="eyebrow">PUZZLE COMPLETE</p><h2>{answerName}</h2><p>{formatNo(puzzle.puzzle_no)} · {LEVELS[puzzle.difficulty].title}</p><div className="resultStats"><span>소요 시간<strong>{formatTime(seconds)}</strong></span>{bestTime!==null&&<span>최고 기록<strong>{formatTime(bestTime)}</strong></span>}</div>{!user&&<button className="loginNudge" onClick={()=>setLoginOpen(true)}>로그인하고 기록 저장하기</button>}<button className="primary" onClick={()=>loadPuzzle(puzzle.difficulty)}>같은 난이도 새 문제</button><button className="secondary" onClick={sharePuzzle}>문제 공유</button><button className="textButton" onClick={()=>setScreen('levels')}>다른 난이도 선택</button><p className="notice">{notice}</p></section>}

    {loginOpen&&<div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&setLoginOpen(false)}><section className="authModal"><button className="close" onClick={()=>setLoginOpen(false)}>×</button><h2>{authMode==='login'?'로그인':'회원가입'}</h2><p>로그인하면 완료 기록과 최고 기록을 저장할 수 있어요.</p><form onSubmit={authSubmit}><label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={authMode==='login'?'current-password':'new-password'}/></label><button className="primary" disabled={loading}>{loading?'처리 중':authMode==='login'?'로그인':'가입하기'}</button></form><button className="textButton" onClick={()=>{setAuthMode(m=>m==='login'?'signup':'login');setNotice('')}}>{authMode==='login'?'계정이 없나요? 회원가입':'이미 계정이 있나요? 로그인'}</button><p className="notice">{notice}</p></section></div>}
  </main>;
}
