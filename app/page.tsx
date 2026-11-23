'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  User,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase';

import {
  type CellState,
  type Difficulty,
  LEVELS,
  type Puzzle,
} from '@/lib/types';

type Screen =
  | 'home'
  | 'guide'
  | 'levels'
  | 'game'
  | 'result'
  | 'my'
  | 'ranking';

type Tool = 1 | 2;

type CollectionItem = {
  puzzle_no: number;
  difficulty: Difficulty;
  answer_name: string;
  solution: number[][];
  best_time_seconds: number;
  last_completed_at: string;
};

type Dashboard = {
  nickname: string | null;
  email: string;
  completed_count: number;
  total_play_seconds: number;
  beginner_count: number;
  novice_count: number;
  skilled_count: number;
  advanced_count: number;
  expert_count: number;
};

type RankingItem = {
  rank: number;
  nickname: string;
  best_time_seconds?: number;
  completed_count?: number;
};

const LEVEL_ILLUSTRATIONS: Record<Difficulty, string> = {
  beginner: '/illustrations/level-beginner.png',
  novice: '/illustrations/level-novice.png',
  skilled: '/illustrations/level-skilled.png',
  advanced: '/illustrations/level-advanced.png',
  expert: '/illustrations/level-expert.png',
};

function formatTime(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
}

function formatPuzzleNumber(puzzleNumber: number) {
  return `#${String(puzzleNumber).padStart(6, '0')}`;
}

function PixelGrid({
  data,
  large = false,
}: {
  data: number[][];
  large?: boolean;
}) {
  const rows = data.length;
  const columns = data[0]?.length ?? 1;

  if (rows === 0) {
    return null;
  }

  return (
    <div
      className={`pixel${large ? ' large' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        aspectRatio: `${columns} / ${rows}`,
      }}
      aria-label="완성한 네모로직 그림"
    >
      {data.flat().map((value, index) => (
        <i
          key={index}
          className={value === 1 ? 'on' : ''}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [grid, setGrid] = useState<CellState[][]>([]);

  const [tool, setTool] = useState<Tool>(1);
  const [history, setHistory] = useState<CellState[][][]>([]);

  const [seconds, setSeconds] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dragValue = useRef<CellState>(1);

  const [answerName, setAnswerName] = useState('');
  const [bestTime, setBestTime] = useState<number | null>(
    null
  );

  const [dashboard, setDashboard] =
    useState<Dashboard | null>(null);

  const [collection, setCollection] = useState<
    CollectionItem[]
  >([]);

  const [nickname, setNickname] = useState('');

  const [ranking, setRanking] = useState<RankingItem[]>([]);

  const [rankingMode, setRankingMode] = useState<
    'weekly' | 'puzzle'
  >('weekly');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (screen !== 'game') {
      return;
    }

    const timerId = window.setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [screen]);

  useEffect(() => {
    const stopDragging = () => {
      setDragging(false);
    };

    window.addEventListener('pointerup', stopDragging);

    return () => {
      window.removeEventListener(
        'pointerup',
        stopDragging
      );
    };
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(
      window.location.search
    );

    const sharedPuzzleNumber = Number(
      query.get('puzzle')
    );

    if (
      !Number.isInteger(sharedPuzzleNumber) ||
      sharedPuzzleNumber < 1
    ) {
      return;
    }

    setLoading(true);
    setNotice('공유 문제를 불러오는 중입니다.');

    supabase
      .rpc('get_puzzle_by_number', {
        target_puzzle_no: sharedPuzzleNumber,
      })
      .then(async ({ data, error }) => {
        setLoading(false);

        if (error || !data?.[0]) {
          setScreen('levels');
          setNotice(
            '공유된 문제를 찾을 수 없어요.'
          );
          return;
        }

        const selectedPuzzle = data[0] as Puzzle;

        initializePuzzle(selectedPuzzle);

        const {
          data: userData,
        } = await supabase.auth.getUser();

        if (userData.user) {
          await supabase.rpc(
            'start_puzzle_session',
            {
              target_puzzle_id:
                selectedPuzzle.id,
            }
          );
        }
      });
  }, [supabase]);

  function initializePuzzle(selectedPuzzle: Puzzle) {
    setPuzzle(selectedPuzzle);

    setGrid(
      Array.from(
        {
          length: selectedPuzzle.rows,
        },
        () =>
          Array<CellState>(
            selectedPuzzle.cols
          ).fill(0)
      )
    );

    setHistory([]);
    setSeconds(0);
    setAnswerName('');
    setBestTime(null);
    setNotice('');
    setScreen('game');
  }

  function isMobileDevice() {
    return window.matchMedia(
      '(max-width: 767px) and (pointer: coarse)'
    ).matches;
  }

  async function handleAuthentication(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setNotice('');

    const result = signupMode
      ? await supabase.auth.signUp({
          email,
          password,
        })
      : await supabase.auth.signInWithPassword({
          email,
          password,
        });

    setLoading(false);

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    if (signupMode && !result.data.session) {
      setNotice(
        '가입 인증 메일을 확인해 주세요.'
      );
      return;
    }

    setNotice('로그인되었습니다.');

    if (result.data.session) {
      setLoginOpen(false);
    }
  }

  async function loadPuzzle(level: Difficulty) {
    if (
      level === 'expert' &&
      isMobileDevice()
    ) {
      setNotice(
        '초고수 난이도는 PC에서만 플레이할 수 있어요.'
      );
      return;
    }

    setLoading(true);
    setNotice('문제를 불러오는 중입니다.');

    const {
      data,
      error,
    } = await supabase.rpc('get_random_puzzle', {
      target_difficulty: level,
      target_user_id: user?.id ?? null,
    });

    setLoading(false);

    if (error) {
      setNotice(
        `문제를 불러오지 못했어요: ${error.message}`
      );
      return;
    }

    const selectedPuzzle = data?.[0] as
      | Puzzle
      | undefined;

    if (!selectedPuzzle) {
      setNotice(
        '아직 이 난이도에 등록된 문제가 없어요.'
      );
      return;
    }

    initializePuzzle(selectedPuzzle);

    if (user) {
      const {
        error: sessionError,
      } = await supabase.rpc(
        'start_puzzle_session',
        {
          target_puzzle_id:
            selectedPuzzle.id,
        }
      );

      if (sessionError) {
        setNotice(
          '플레이 시작 기록을 저장하지 못했어요.'
        );
      }
    }
  }

  function updateCell(
    rowIndex: number,
    columnIndex: number,
    value: CellState
  ) {
    setGrid((previousGrid) => {
      if (
        previousGrid[rowIndex]?.[columnIndex] ===
        value
      ) {
        return previousGrid;
      }

      const snapshot = previousGrid.map((row) => [
        ...row,
      ]);

      setHistory((previousHistory) => [
        ...previousHistory.slice(-49),
        snapshot,
      ]);

      return previousGrid.map((row, currentRow) =>
        row.map((cell, currentColumn) => {
          if (
            currentRow === rowIndex &&
            currentColumn === columnIndex
          ) {
            return value;
          }

          return cell;
        })
      ) as CellState[][];
    });
  }

  function handleCellPointerDown(
    rowIndex: number,
    columnIndex: number
  ) {
    const currentValue =
      grid[rowIndex]?.[columnIndex] ?? 0;

    const nextValue: CellState =
      currentValue === tool ? 0 : tool;

    dragValue.current = nextValue;
    setDragging(true);

    updateCell(
      rowIndex,
      columnIndex,
      nextValue
    );
  }

  function undo() {
    const previousGrid =
      history[history.length - 1];

    if (!previousGrid) {
      return;
    }

    setGrid(previousGrid);

    setHistory((previousHistory) =>
      previousHistory.slice(0, -1)
    );
  }

  async function submitAnswer() {
    if (!puzzle) {
      return;
    }

    setLoading(true);
    setNotice('정답을 확인하는 중입니다.');

    const submittedSolution = grid.map((row) =>
      row.map((cell) => (cell === 1 ? 1 : 0))
    );

    const request = user
      ? supabase.rpc('complete_puzzle', {
          target_puzzle_id: puzzle.id,
          submitted_solution:
            submittedSolution,
          submitted_elapsed_seconds:
            seconds,
          submitted_mistakes: 0,
        })
      : supabase.rpc('check_puzzle_answer', {
          target_puzzle_id: puzzle.id,
          submitted_solution:
            submittedSolution,
        });

    const {
      data,
      error,
    } = await request;

    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    const result = data?.[0];

    if (!result?.correct) {
      setNotice(
        '아직 맞지 않는 칸이 있어요. 다시 확인해보세요.'
      );
      return;
    }

    setAnswerName(result.answer_name);
    setBestTime(
      result.best_time_seconds ?? null
    );

    setNotice('');
    setScreen('result');
  }

  async function openMyPage() {
    if (!user) {
      setLoginOpen(true);
      return;
    }

    setLoading(true);
    setNotice('');

    const [
      dashboardResult,
      collectionResult,
    ] = await Promise.all([
      supabase.rpc('get_my_dashboard'),
      supabase.rpc('get_my_collection'),
    ]);

    setLoading(false);

    if (dashboardResult.error) {
      setNotice(dashboardResult.error.message);
      return;
    }

    if (collectionResult.error) {
      setNotice(collectionResult.error.message);
      return;
    }

    const profile = dashboardResult.data?.[0] as
      | Dashboard
      | undefined;

    setDashboard(profile ?? null);
    setNickname(profile?.nickname ?? '');

    setCollection(
      (collectionResult.data ??
        []) as CollectionItem[]
    );

    setScreen('my');
  }

  async function saveNickname() {
    const trimmedNickname = nickname.trim();

    if (
      trimmedNickname.length < 2 ||
      trimmedNickname.length > 12
    ) {
      setNotice(
        '닉네임은 2자 이상 12자 이하로 입력해 주세요.'
      );
      return;
    }

    setLoading(true);
    setNotice('');

    const {
      data,
      error,
    } = await supabase.rpc('set_my_nickname', {
      new_nickname: trimmedNickname,
    });

    setLoading(false);

    if (error) {
      if (
        error.message.includes(
          'NICKNAME_TAKEN'
        )
      ) {
        setNotice(
          '이미 사용 중인 닉네임이에요.'
        );
        return;
      }

      if (
        error.message.includes(
          'NICKNAME_FORMAT'
        )
      ) {
        setNotice(
          '한글, 영문, 숫자와 중간 공백·하이픈·밑줄만 사용할 수 있어요.'
        );
        return;
      }

      setNotice(error.message);
      return;
    }

    setNickname(String(data));
    setNotice('닉네임을 저장했어요.');

    await openMyPage();
  }

  async function openRanking(
    mode: 'weekly' | 'puzzle' = 'weekly'
  ) {
    setRankingMode(mode);
    setLoading(true);
    setNotice('');

    if (mode === 'puzzle' && !puzzle) {
      setLoading(false);
      setNotice(
        '먼저 문제를 선택해 주세요.'
      );
      return;
    }

    const result =
      mode === 'weekly'
        ? await supabase.rpc(
            'get_weekly_ranking',
            {
              ranking_limit: 20,
            }
          )
        : await supabase.rpc(
            'get_puzzle_ranking',
            {
              target_puzzle_no:
                puzzle!.puzzle_no,
              ranking_limit: 20,
            }
          );

    setLoading(false);

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    setRanking(
      (result.data ?? []) as RankingItem[]
    );

    setScreen('ranking');
  }

  async function sharePuzzle() {
    if (!puzzle) {
      return;
    }

    const shareUrl =
      `${window.location.origin}/?puzzle=${puzzle.puzzle_no}`;

    const shareText =
      `월루로직 ${formatPuzzleNumber(
        puzzle.puzzle_no
      )}에 도전해보세요.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: '월루로직',
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(
          shareUrl
        );

        setNotice(
          '문제 링크를 복사했어요.'
        );
      }
    } catch {
      // 사용자가 공유창을 닫은 경우
    }
  }

  const completedGrid = grid.map((row) =>
    row.map((cell) => (cell === 1 ? 1 : 0))
  );

  return (
    <main className="shell">
      <header className="top">
        <button
          type="button"
          onClick={() => setScreen('home')}
        >
          월루로직
        </button>

        <nav aria-label="주요 메뉴">
          <button
            type="button"
            onClick={() => setScreen('levels')}
          >
            문제
          </button>

          <button
            type="button"
            onClick={() => openRanking('weekly')}
          >
            랭킹
          </button>

          <button
            type="button"
            onClick={openMyPage}
          >
            MY
          </button>

          {user ? (
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();

                setDashboard(null);
                setCollection([]);
                setNickname('');
                setScreen('home');
              }}
            >
              로그아웃
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNotice('');
                setLoginOpen(true);
              }}
            >
              로그인
            </button>
          )}
        </nav>
      </header>

      {screen === 'home' && (
        <section className="home page">
          <h1>월루로직</h1>

          <img
            src="/illustrations/home-cat.png"
            alt=""
            aria-hidden="true"
          />

          <button
            type="button"
            className="primary"
            onClick={() => setScreen('guide')}
          >
            월루 시작 →
          </button>
        </section>
      )}

      {screen === 'guide' && (
        <section className="page guide">
          <button
            type="button"
            className="x"
            aria-label="게임 방법 닫기"
            onClick={() => setScreen('levels')}
          >
            ×
          </button>

          <h2>네모로직, 이렇게 풀어요</h2>

          <img
            src="/illustrations/guide-cat.png"
            alt=""
            aria-hidden="true"
          />

          <ol>
            <li>
              <b>숫자 힌트를 확인하세요</b>

              <p>
                각 숫자는 연속해서 채워야 하는
                칸의 개수예요.
              </p>
            </li>

            <li>
              <b>칸을 채우거나 X로 표시하세요</b>

              <p>
                정답 칸은 채우고 비어 있다고
                판단한 칸은 X로 표시해요.
              </p>
            </li>

            <li>
              <b>모든 조건을 맞추면 완료</b>

              <p>
                완성한 네모로직 그림이 결과
                화면에 나타나요.
              </p>
            </li>
          </ol>

          <button
            type="button"
            className="primary"
            onClick={() => setScreen('levels')}
          >
            확인했어요
          </button>
        </section>
      )}

      {screen === 'levels' && (
        <section className="page">
          <h2>난이도를 선택하세요</h2>

          <div className="levels">
            {(
              Object.keys(
                LEVELS
              ) as Difficulty[]
            ).map((levelKey) => {
              const level =
                LEVELS[levelKey];

              return (
                <button
                  type="button"
                  key={levelKey}
                  onClick={() =>
                    loadPuzzle(levelKey)
                  }
                  disabled={loading}
                >
                  <img
                    src={
                      LEVEL_ILLUSTRATIONS[
                        levelKey
                      ]
                    }
                    alt=""
                    aria-hidden="true"
                  />

                  <span>
                    <b>{level.title}</b>

                    <small>
                      {level.description}
                    </small>

                    {level.pcOnly && (
                      <em>PC 전용</em>
                    )}
                  </span>

                  <strong>›</strong>
                </button>
              );
            })}
          </div>

          <p
            className="notice"
            aria-live="polite"
          >
            {notice}
          </p>
        </section>
      )}

      {screen === 'game' && puzzle && (
        <section className="page game">
          <div className="gamehead">
            <button
              type="button"
              aria-label="난이도 선택으로 돌아가기"
              onClick={() => setScreen('levels')}
            >
              ←
            </button>

            <span>
              <b>
                {formatPuzzleNumber(
                  puzzle.puzzle_no
                )}
              </b>

              <small>
                {
                  LEVELS[puzzle.difficulty]
                    .title
                }
              </small>
            </span>

            <time>{formatTime(seconds)}</time>
          </div>

          <div className="boardscroll">
            <div
              className="boardwrap"
              style={
                {
                  '--r': puzzle.rows,
                  '--c': puzzle.cols,
                } as React.CSSProperties
              }
            >
              <div />

              <div className="colh">
                {puzzle.column_hints.map(
                  (
                    hints,
                    columnIndex
                  ) => (
                    <div key={columnIndex}>
                      {hints.map(
                        (
                          value,
                          hintIndex
                        ) => (
                          <span
                            key={hintIndex}
                          >
                            {value}
                          </span>
                        )
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="rowh">
                {puzzle.row_hints.map(
                  (hints, rowIndex) => (
                    <div key={rowIndex}>
                      {hints.map(
                        (
                          value,
                          hintIndex
                        ) => (
                          <span
                            key={hintIndex}
                          >
                            {value}
                          </span>
                        )
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="board">
                {grid.map(
                  (row, rowIndex) =>
                    row.map(
                      (
                        value,
                        columnIndex
                      ) => (
                        <button
                          type="button"
                          key={`${rowIndex}-${columnIndex}`}
                          aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열`}
                          className={
                            value === 1
                              ? 'filled'
                              : value === 2
                                ? 'cross'
                                : ''
                          }
                          onPointerDown={(
                            event
                          ) => {
                            event.preventDefault();

                            handleCellPointerDown(
                              rowIndex,
                              columnIndex
                            );
                          }}
                          onPointerEnter={() => {
                            if (dragging) {
                              updateCell(
                                rowIndex,
                                columnIndex,
                                dragValue.current
                              );
                            }
                          }}
                        />
                      )
                    )
                )}
              </div>
            </div>
          </div>

          <div className="tools">
            <button
              type="button"
              className={
                tool === 1
                  ? 'active'
                  : ''
              }
              onClick={() => setTool(1)}
            >
              ■ 채우기
            </button>

            <button
              type="button"
              className={
                tool === 2
                  ? 'active'
                  : ''
              }
              onClick={() => setTool(2)}
            >
              × 표시
            </button>

            <button
              type="button"
              onClick={undo}
            >
              ↶ 실행취소
            </button>
          </div>

          <p
            className="notice"
            aria-live="polite"
          >
            {notice}
          </p>

          <button
            type="button"
            className="primary"
            onClick={submitAnswer}
            disabled={loading}
          >
            {loading
              ? '확인 중'
              : '정답 확인'}
          </button>
        </section>
      )}

      {screen === 'result' && puzzle && (
        <section className="page result">
          <h2>완성!</h2>

          <PixelGrid
            data={completedGrid}
            large
          />

          <h3>{answerName}</h3>

          <p>
            {formatPuzzleNumber(
              puzzle.puzzle_no
            )}
            {' · '}
            {
              LEVELS[puzzle.difficulty]
                .title
            }
          </p>

          <div className="stats">
            <span>
              소요 시간

              <b>{formatTime(seconds)}</b>
            </span>

            {bestTime !== null && (
              <span>
                최고 기록

                <b>
                  {formatTime(bestTime)}
                </b>
              </span>
            )}
          </div>

          {!user && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setNotice('');
                setLoginOpen(true);
              }}
            >
              로그인하고 기록 저장하기
            </button>
          )}

          <button
            type="button"
            className="primary"
            onClick={() =>
              loadPuzzle(
                puzzle.difficulty
              )
            }
          >
            같은 난이도 새 문제
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() =>
              openRanking('puzzle')
            }
          >
            이 문제 랭킹
          </button>

          <button
            type="button"
            className="secondary"
            onClick={sharePuzzle}
          >
            문제 공유
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() =>
              setScreen('levels')
            }
          >
            다른 난이도 선택
          </button>

          <p className="notice">{notice}</p>
        </section>
      )}

      {screen === 'my' && (
        <section className="page my">
          <h2>내 월루</h2>

          {loading && (
            <p className="notice">
              기록을 불러오는 중입니다.
            </p>
          )}

          {dashboard && (
            <>
              <label>
                닉네임

                <div className="nick">
                  <input
                    type="text"
                    value={nickname}
                    minLength={2}
                    maxLength={12}
                    placeholder="닉네임을 입력하세요"
                    onChange={(event) =>
                      setNickname(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={saveNickname}
                    disabled={loading}
                  >
                    저장
                  </button>
                </div>
              </label>

              <small>{dashboard.email}</small>

              <div className="stats">
                <span>
                  완료한 문제

                  <b>
                    {
                      dashboard.completed_count
                    }
                  </b>
                </span>

                <span>
                  기록 합계

                  <b>
                    {formatTime(
                      dashboard.total_play_seconds
                    )}
                  </b>
                </span>
              </div>

              <h3>난이도별 완료</h3>

              <div className="chips">
                <i>
                  초보자{' '}
                  {
                    dashboard.beginner_count
                  }
                </i>

                <i>
                  입문자{' '}
                  {dashboard.novice_count}
                </i>

                <i>
                  숙련자{' '}
                  {
                    dashboard.skilled_count
                  }
                </i>

                <i>
                  고수{' '}
                  {
                    dashboard.advanced_count
                  }
                </i>

                <i>
                  초고수{' '}
                  {dashboard.expert_count}
                </i>
              </div>

              <h3>완성한 그림</h3>

              {collection.length === 0 ? (
                <p>
                  아직 완성한 문제가 없어요.
                </p>
              ) : (
                <div className="collection">
                  {collection.map((item) => (
                    <article
                      key={item.puzzle_no}
                    >
                      <PixelGrid
                        data={item.solution}
                      />

                      <b>
                        {item.answer_name}
                      </b>

                      <small>
                        {formatPuzzleNumber(
                          item.puzzle_no
                        )}
                        {' · '}
                        {formatTime(
                          item.best_time_seconds
                        )}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          <p
            className="notice"
            aria-live="polite"
          >
            {notice}
          </p>
        </section>
      )}

      {screen === 'ranking' && (
        <section className="page ranking">
          <h2>
            {rankingMode === 'weekly'
              ? '주간 랭킹'
              : puzzle
                ? `${formatPuzzleNumber(
                    puzzle.puzzle_no
                  )} 랭킹`
                : '문제 랭킹'}
          </h2>

          <div className="tabs">
            <button
              type="button"
              onClick={() =>
                openRanking('weekly')
              }
            >
              주간 완료
            </button>

            {puzzle && (
              <button
                type="button"
                onClick={() =>
                  openRanking('puzzle')
                }
              >
                현재 문제
              </button>
            )}
          </div>

          {loading ? (
            <p>랭킹을 불러오는 중입니다.</p>
          ) : ranking.length === 0 ? (
            <p>아직 랭킹 기록이 없어요.</p>
          ) : (
            <ol>
              {ranking.map((item) => (
                <li
                  key={`${item.rank}-${item.nickname}`}
                >
                  <strong>{item.rank}</strong>

                  <b>{item.nickname}</b>

                  <span>
                    {item.best_time_seconds !==
                    undefined
                      ? formatTime(
                          item.best_time_seconds
                        )
                      : `${item.completed_count ?? 0}개`}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p
            className="notice"
            aria-live="polite"
          >
            {notice}
          </p>
        </section>
      )}

      {loginOpen && (
        <div
          className="modal"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setLoginOpen(false);
            }
          }}
        >
          <form
            onSubmit={handleAuthentication}
          >
            <button
              type="button"
              className="x"
              aria-label="로그인 창 닫기"
              onClick={() =>
                setLoginOpen(false)
              }
            >
              ×
            </button>

            <h2>
              {signupMode
                ? '회원가입'
                : '로그인'}
            </h2>

            <input
              type="email"
              placeholder="이메일"
              value={email}
              autoComplete="email"
              required
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
            />

            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              minLength={6}
              required
              autoComplete={
                signupMode
                  ? 'new-password'
                  : 'current-password'
              }
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
            />

            <button
              type="submit"
              className="primary"
              disabled={loading}
            >
              {loading
                ? '처리 중'
                : signupMode
                  ? '가입하기'
                  : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSignupMode(
                  (previous) => !previous
                );

                setNotice('');
              }}
            >
              {signupMode
                ? '이미 계정이 있나요? 로그인'
                : '계정이 없나요? 회원가입'}
            </button>

            <p
              className="notice"
              aria-live="polite"
            >
              {notice}
            </p>
          </form>
        </div>
      )}
    </main>
  );
}
