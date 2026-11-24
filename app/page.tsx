'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { CellState, Difficulty, LEVELS, Puzzle } from '@/lib/types';

type Screen = 'home' | 'guide' | 'levels' | 'game' | 'result' | 'my' | 'ranking';
type Collection = { puzzle_no:number; difficulty:Difficulty; answer_name:string; solution:number[][]; best_time_seconds:number; last_completed_at:string };
type Dashboard = { nickname:string|null; email:string; completed_count:number; total_play_seconds:number; beginner_count:number; novice_count:number; skilled_count:number; advanced_count:number; expert_count:number };
type Rank = { rank:number; nickname:string; best_time_seconds?:number; completed_count?:number };
type BoardStyle = React.CSSProperties & { '--r':number; '--c':number; '--cell-size':string; '--row-hint-width':string; '--column-hint-height':string };

const art: Record<Difficulty,string> = {
  beginner:'/illustrations/level-beginner.png', novice:'/illustrations/level-novice.png',
  skilled:'/illustrations/level-skilled.png', advanced:'/illustrations/level-advanced.png',
  expert:'/illustrations/level-expert.png'
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [screen,setScreen] = useState<Screen>('home');
  const [user,setUser] = useState<User|null>(null);
  const [loginOpen,setLoginOpen] = useState(false);
  const [signup,setSignup] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(false);
  const [puzzle,setPuzzle] = useState<Puzzle|null>(null);
  const [grid,setGrid] = useState<CellState[][]>([]);
  const [tool,setTool] = useState<1|2>(1);
  const [history,setHistory] = useState<CellState[][][]>([]);
  const [seconds,setSeconds] = useState(0);
  const [drag,setDrag] = useState(false);
  const [cursor,setCursor] = useState({row:0,col:0});
  const [isCoarsePointer,setIsCoarsePointer] = useState(false);
  const moveDelayRef = useRef<number|null>(null);
  const moveIntervalRef = useRef<number|null>(null);
  const [cellSize,setCellSize] = useState(32);
  const [rowHintWidth,setRowHintWidth] = useState(52);
  const [columnHintHeight,setColumnHintHeight] = useState(52);
  const dragValue = useRef<CellState>(1);
  const [answerName,setAnswerName] = useState('');
  const [bestTime,setBestTime] = useState<number|null>(null);
  const [dash,setDash] = useState<Dashboard|null>(null);
  const [collection,setCollection] = useState<Collection[]>([]);
  const [nickname,setNickname] = useState('');
  const [ranks,setRanks] = useState<Rank[]>([]);
  const [rankMode,setRankMode] = useState<'weekly'|'puzzle'>('weekly');

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => setUser(data.user));
    const {data} = supabase.auth.onAuthStateChange((_e,s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setIsCoarsePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (screen !== 'game') return;
    const timer = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const stop = () => setDrag(false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  useEffect(() => () => stopCursorRepeat(), []);

  useEffect(() => {
    if (screen !== 'game' || !puzzle) return;
    const fit = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const maxRowHints = Math.max(1, ...puzzle.row_hints.map(h => h.length));
      const maxColumnHints = Math.max(1, ...puzzle.column_hints.map(h => h.length));
      const mobile = window.matchMedia('(max-width:699px)').matches;
      const computedRowHint = Math.max(34, maxRowHints * (mobile ? 14 : 17) + 10);
      const computedColumnHint = Math.max(32, maxColumnHints * (mobile ? 13 : 16) + 8);
      const horizontalOutside = mobile ? 24 : Math.max(40, viewportWidth - 500);
      const reservedVertical = mobile ? 62 + 50 + 118 + 14 + 44 + 18 : 62 + 54 + 62 + 20 + 54 + 60;
      const byWidth = (viewportWidth - horizontalOutside - computedRowHint - 4) / puzzle.cols;
      const byHeight = (viewportHeight - reservedVertical - computedColumnHint - 4) / puzzle.rows;
      const next = Math.floor(Math.min(byWidth, byHeight, mobile ? 64 : 36));
      setCellSize(Math.max(mobile ? 10 : 14, next));
      setRowHintWidth(computedRowHint);
      setColumnHintHeight(computedColumnHint);
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, [screen,puzzle]);

  useEffect(() => {
    if (screen !== 'game' || !puzzle) return;
    const onKey = (e:KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','x','z',' '].includes(k)) e.preventDefault();
      if (k === 'arrowup' || k === 'w') setCursor(v => ({row:Math.max(0,v.row-1),col:v.col}));
      else if (k === 'arrowdown') setCursor(v => ({row:Math.min(puzzle.rows-1,v.row+1),col:v.col}));
      else if (k === 'arrowleft') setCursor(v => ({row:v.row,col:Math.max(0,v.col-1)}));
      else if (k === 'arrowright' || k === 'd') setCursor(v => ({row:v.row,col:Math.min(puzzle.cols-1,v.col+1)}));
      else if (k === 'a') { setTool(1); cell(cursor.row,cursor.col,grid[cursor.row][cursor.col]===1?0:1); }
      else if (k === 's') { setTool(2); cell(cursor.row,cursor.col,grid[cursor.row][cursor.col]===2?0:2); }
      else if (k === 'x' || k === 'z' || k === ' ') cell(cursor.row,cursor.col,0);
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [screen,puzzle,cursor,grid]);

  const time = (s:number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const no = (n:number) => `#${String(n).padStart(6,'0')}`;

  async function auth(e:React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const r = signup ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({email,password});
    setLoading(false);
    if (r.error) return setNotice(r.error.message);
    setNotice(signup && !r.data.session ? '인증 메일을 확인해 주세요.' : '로그인되었습니다.');
    if (r.data.session) setLoginOpen(false);
  }

  async function load(level:Difficulty) {
    if (level === 'expert' && matchMedia('(max-width:767px) and (pointer:coarse)').matches) return setNotice('초고수는 PC에서만 플레이할 수 있어요.');
    setLoading(true);
    const {data,error} = await supabase.rpc('get_random_puzzle',{target_difficulty:level,target_user_id:user?.id??null});
    setLoading(false);
    if (error || !data?.[0]) return setNotice(error?.message ?? '이 난이도에 등록된 문제가 없어요.');
    const p = data[0] as Puzzle;
    setPuzzle(p); setGrid(Array.from({length:p.rows},()=>Array(p.cols).fill(0)));
    setHistory([]); setCursor({row:0,col:0}); setSeconds(0); setNotice('');
    if (user) await supabase.rpc('start_puzzle_session',{target_puzzle_id:p.id});
    setScreen('game');
  }

  function cell(r:number,c:number,v:CellState) {
    setGrid(prev => {
      if (prev[r][c] === v) return prev;
      setHistory(h => [...h.slice(-49),prev.map(x => [...x])]);
      return prev.map((x,ri)=>x.map((q,ci)=>ri===r&&ci===c?v:q)) as CellState[][];
    });
  }
  function down(r:number,c:number) { const v:CellState=grid[r][c]===tool?0:tool; dragValue.current=v; setDrag(true); cell(r,c,v); }

  function cycleCell(r:number,c:number) {
    const current = grid[r]?.[c] ?? 0;
    cell(r,c,((current + 1) % 3) as CellState);
  }

  function toggleCursorValue(value:1|2) {
    const current = grid[cursor.row]?.[cursor.col] ?? 0;
    cell(cursor.row,cursor.col,current === value ? 0 : value);
    setTool(value);
  }

  function moveCursor(dr:number,dc:number) {
    if (!puzzle) return;
    setCursor(previous => ({
      row:Math.max(0,Math.min(puzzle.rows-1,previous.row+dr)),
      col:Math.max(0,Math.min(puzzle.cols-1,previous.col+dc))
    }));
  }

  function stopCursorRepeat() {
    if (moveDelayRef.current !== null) window.clearTimeout(moveDelayRef.current);
    if (moveIntervalRef.current !== null) window.clearInterval(moveIntervalRef.current);
    moveDelayRef.current=null;
    moveIntervalRef.current=null;
  }

  function startCursorRepeat(dr:number,dc:number) {
    stopCursorRepeat();
    moveCursor(dr,dc);
    moveDelayRef.current=window.setTimeout(() => {
      moveIntervalRef.current=window.setInterval(() => moveCursor(dr,dc),90);
    },320);
  }

  async function submit() {
    if (!puzzle) return;
    setLoading(true);
    const solution=grid.map(r=>r.map(c=>c===1?1:0));
    const req=user ? supabase.rpc('complete_puzzle',{target_puzzle_id:puzzle.id,submitted_solution:solution,submitted_elapsed_seconds:seconds,submitted_mistakes:0}) : supabase.rpc('check_puzzle_answer',{target_puzzle_id:puzzle.id,submitted_solution:solution});
    const {data,error}=await req; setLoading(false);
    if (error) return setNotice(error.message);
    if (!data?.[0]?.correct) return setNotice('아직 맞지 않는 칸이 있어요.');
    setAnswerName(data[0].answer_name); setBestTime(data[0].best_time_seconds??null); setScreen('result');
  }

  async function openMy(){ if(!user)return setLoginOpen(true); setLoading(true); const[d,c]=await Promise.all([supabase.rpc('get_my_dashboard'),supabase.rpc('get_my_collection')]); setLoading(false); if(d.error||c.error)return setNotice(d.error?.message??c.error?.message??'불러오기 실패'); setDash(d.data?.[0]??null); setNickname(d.data?.[0]?.nickname??''); setCollection(c.data??[]); setScreen('my'); }
  async function saveNick(){ const{data,error}=await supabase.rpc('set_my_nickname',{new_nickname:nickname}); if(error)return setNotice(error.message); setNickname(data); setNotice('닉네임을 저장했어요.'); openMy(); }
  async function openRanking(mode:'weekly'|'puzzle'='weekly'){ setRankMode(mode); const res=mode==='weekly'?await supabase.rpc('get_weekly_ranking',{ranking_limit:20}):puzzle?await supabase.rpc('get_puzzle_ranking',{target_puzzle_no:puzzle.puzzle_no,ranking_limit:20}):null; if(!res)return setNotice('먼저 문제를 선택해 주세요.'); if(res.error)return setNotice(res.error.message); setRanks(res.data??[]); setScreen('ranking'); }

  const Pixel=({data,large=false}:{data:number[][];large?:boolean}) => <div className={`pixel ${large?'large':''}`} style={{gridTemplateColumns:`repeat(${data[0]?.length??1},1fr)`,aspectRatio:`${data[0]?.length??1}/${data.length}`}}>{data.flat().map((v,i)=><i className={v===1?'on':''} key={i}/>)}</div>;
  const boardStyle:BoardStyle = {'--r':puzzle?.rows??1,'--c':puzzle?.cols??1,'--cell-size':`${cellSize}px`,'--row-hint-width':`${rowHintWidth}px`,'--column-hint-height':`${columnHintHeight}px`};

  return <main className="shell"><header className="top"><button onClick={()=>setScreen('home')}>월루로직</button><nav><button onClick={()=>setScreen('levels')}>문제</button><button onClick={()=>openRanking()}>랭킹</button><button onClick={openMy}>MY</button>{user?<button onClick={()=>supabase.auth.signOut()}>로그아웃</button>:<button onClick={()=>setLoginOpen(true)}>로그인</button>}</nav></header>
  {screen==='home'&&<section className="home page"><h1>월루로직</h1><img src="/illustrations/home-cat.png" alt=""/><button className="primary" onClick={()=>setScreen('guide')}>월루 시작 →</button></section>}
  {screen==='guide'&&<section className="page guide"><button className="x" onClick={()=>setScreen('levels')}>×</button><h2>네모로직, 이렇게 풀어요</h2><img src="/illustrations/guide-cat.png" alt=""/><ol><li><b>숫자 힌트를 확인하세요</b><p>각 숫자는 연속해서 채워야 하는 칸의 개수예요.</p></li><li><b>칸을 채우거나 X로 표시하세요</b><p>정답 칸은 채우고 빈칸은 X로 표시해요.</p></li><li><b>모든 조건을 맞추면 완료</b><p>완성된 네모로직 그림이 결과에 나타나요.</p></li></ol><button className="primary" onClick={()=>setScreen('levels')}>확인했어요</button></section>}
  {screen==='levels'&&<section className="page"><h2>난이도를 선택하세요</h2><div className="levels">{(Object.keys(LEVELS) as Difficulty[]).map(k=><button key={k} onClick={()=>load(k)}><img src={art[k]} alt=""/><span><b>{LEVELS[k].title}</b><small>{LEVELS[k].description}</small>{LEVELS[k].pcOnly&&<em>PC 전용</em>}</span><strong>›</strong></button>)}</div><p className="notice">{notice}</p></section>}
  {screen==='game'&&puzzle&&<section className="page game"><div className="gamehead"><button onClick={()=>setScreen('levels')}>←</button><span><b>{no(puzzle.puzzle_no)}</b><small>{LEVELS[puzzle.difficulty].title}</small></span><time>{time(seconds)}</time></div><div className="boardscroll"><div className="boardwrap" style={boardStyle}><div/><div className="colh">{puzzle.column_hints.map((h,i)=><div key={i}>{h.map((n,j)=><span key={j}>{n}</span>)}</div>)}</div><div className="rowh">{puzzle.row_hints.map((h,i)=><div key={i}>{h.map((n,j)=><span key={j}>{n}</span>)}</div>)}</div><div className="board">{grid.map((r,ri)=>r.map((v,ci)=><button type="button" aria-label={`${ri+1}행 ${ci+1}열`} key={`${ri}-${ci}`} className={[v===1?'filled':v===2?'cross':'',ri===cursor.row&&ci===cursor.col?'cursor':'',((ci+1)%5===0&&ci<puzzle.cols-1)?'major-right':'',((ri+1)%5===0&&ri<puzzle.rows-1)?'major-bottom':''].filter(Boolean).join(' ')} onPointerDown={e=>{e.preventDefault();setCursor({row:ri,col:ci});if(isCoarsePointer)cycleCell(ri,ci);else down(ri,ci)}} onPointerEnter={()=>!isCoarsePointer&&drag&&cell(ri,ci,dragValue.current)}/>))}</div></div></div><div className="tools desktop-tools"><button className={tool===1?'active':''} onClick={()=>setTool(1)}>■ 채우기</button><button className={tool===2?'active':''} onClick={()=>setTool(2)}>X 표시</button><button onClick={()=>{const p=history[history.length-1];if(p){setGrid(p);setHistory(h=>h.slice(0,-1))}}}>↶ 실행취소</button></div><div className="mobile-game-controls" aria-label="모바일 퍼즐 조작부"><div className="mobile-dpad"><button type="button" className="dpad-up" aria-label="위로 이동" onPointerDown={e=>{e.preventDefault();startCursorRepeat(-1,0)}} onPointerUp={stopCursorRepeat} onPointerCancel={stopCursorRepeat} onPointerLeave={stopCursorRepeat}>↑</button><button type="button" className="dpad-left" aria-label="왼쪽으로 이동" onPointerDown={e=>{e.preventDefault();startCursorRepeat(0,-1)}} onPointerUp={stopCursorRepeat} onPointerCancel={stopCursorRepeat} onPointerLeave={stopCursorRepeat}>←</button><span className="dpad-center" aria-hidden="true"/><button type="button" className="dpad-right" aria-label="오른쪽으로 이동" onPointerDown={e=>{e.preventDefault();startCursorRepeat(0,1)}} onPointerUp={stopCursorRepeat} onPointerCancel={stopCursorRepeat} onPointerLeave={stopCursorRepeat}>→</button><button type="button" className="dpad-down" aria-label="아래로 이동" onPointerDown={e=>{e.preventDefault();startCursorRepeat(1,0)}} onPointerUp={stopCursorRepeat} onPointerCancel={stopCursorRepeat} onPointerLeave={stopCursorRepeat}>↓</button></div><div className="mobile-actions"><button type="button" aria-label="선택한 칸 채우기" className={tool===1?'active':''} onClick={()=>toggleCursorValue(1)}><strong aria-hidden="true">■</strong></button><button type="button" aria-label="선택한 칸 X 표시" className={tool===2?'active':''} onClick={()=>toggleCursorValue(2)}><strong aria-hidden="true">X</strong></button></div></div><p className="keyboard-help">방향키: 이동 · A: 채우기 · S: X 표시 · X/Z/Space: 지우기</p><p className="notice">{notice}</p><button className="primary" onClick={submit}>정답 확인</button></section>}
  {screen==='result'&&puzzle&&<section className="page result"><h2>완성!</h2><Pixel data={grid.map(r=>r.map(v=>v===1?1:0))} large/><h3>{answerName}</h3><p>{no(puzzle.puzzle_no)} · {LEVELS[puzzle.difficulty].title}</p><div className="stats"><span>소요 시간<b>{time(seconds)}</b></span>{bestTime!==null&&<span>최고 기록<b>{time(bestTime)}</b></span>}</div><button className="primary" onClick={()=>load(puzzle.difficulty)}>같은 난이도 새 문제</button><button className="secondary" onClick={()=>openRanking('puzzle')}>이 문제 랭킹</button><button className="secondary" onClick={()=>navigator.clipboard.writeText(`${location.origin}/?puzzle=${puzzle.puzzle_no}`)}>문제 공유</button></section>}
  {screen==='my'&&<section className="page my"><h2>내 월루</h2>{dash&&<><label>닉네임<div className="nick"><input value={nickname} maxLength={12} onChange={e=>setNickname(e.target.value)}/><button onClick={saveNick}>저장</button></div></label><small>{dash.email}</small><div className="stats"><span>완료한 문제<b>{dash.completed_count}</b></span><span>기록 합계<b>{time(dash.total_play_seconds)}</b></span></div><h3>난이도별 완료</h3><div className="chips"><i>초보자 {dash.beginner_count}</i><i>입문자 {dash.novice_count}</i><i>숙련자 {dash.skilled_count}</i><i>고수 {dash.advanced_count}</i><i>초고수 {dash.expert_count}</i></div><h3>완성한 그림</h3><div className="collection">{collection.map(x=><article key={x.puzzle_no}><Pixel data={x.solution}/><b>{x.answer_name}</b><small>{no(x.puzzle_no)} · {time(x.best_time_seconds)}</small></article>)}</div></>}</section>}
  {screen==='ranking'&&<section className="page ranking"><h2>{rankMode==='weekly'?'주간 랭킹':`${puzzle?no(puzzle.puzzle_no):''} 랭킹`}</h2><div className="tabs"><button onClick={()=>openRanking('weekly')}>주간 완료</button>{puzzle&&<button onClick={()=>openRanking('puzzle')}>현재 문제</button>}</div><ol>{ranks.map(x=><li key={`${x.rank}-${x.nickname}`}><strong>{x.rank}</strong><b>{x.nickname}</b><span>{x.best_time_seconds!=null?time(x.best_time_seconds):`${x.completed_count}개`}</span></li>)}</ol>{!ranks.length&&<p>아직 랭킹 기록이 없어요.</p>}</section>}
  {loginOpen&&<div className="modal"><form onSubmit={auth}><button type="button" className="x" onClick={()=>setLoginOpen(false)}>×</button><h2>{signup?'회원가입':'로그인'}</h2><input type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/><button className="primary">{signup?'가입하기':'로그인'}</button><button type="button" onClick={()=>setSignup(v=>!v)}>{signup?'이미 계정이 있나요?':'계정이 없나요?'}</button><p>{notice}</p></form></div>}</main>;
}
