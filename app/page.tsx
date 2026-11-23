'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import {
  CellState,
  Difficulty,
  LEVELS,
  Puzzle,
} from '@/lib/types';

type Screen = 'home' | 'guide' | 'levels' | 'game' | 'result';
type Tool = 1 | 2;

const LEVEL_ILLUSTRATIONS: Record<Difficulty, string> = {
  beginner: '/illustrations/level-beginner.png',
  novice: '/illustrations/level-novice.png',
  skilled: '/illustrations/level-skilled.png',
  advanced: '/illustrations/level-advanced.png',
  expert: '/illustrations/level-expert.png',
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] =
    useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  const [grid, setGrid] =
    useState<CellState[][]>([]);

  const [tool, setTool] =
    useState<Tool>(1);

  const [history, setHistory] =
    useState<CellState[][][]>([]);

  const [seconds, setSeconds] = useState(0);

  const [answerName, setAnswerName] =
    useState('');

  const [bestTime, setBestTime] =
    useState<number | null>(null);

  const [drag, setDrag] = useState(false);

  const dragValue =
    useRef<CellState>(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null);
        }
      );

    return () =>
      data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const number = Number(
      new URLSearchParams(
        window.location.search
      ).get('puzzle')
    );

    if (!Number.isInteger(number) || number < 1) {
      return;
    }

    setLoading(true);
    setNotice('공유 문제를 불러오는 중입니다.');

    supabase
      .rpc('get_puzzle_by_number', {
        target_puzzle_no: number,
      })
      .then(({ data, error }) => {
        setLoading(false);

        if (error || !data?.[0]) {
          setScreen('levels');
          setNotice(
            '공유된 문제를 찾을 수 없어요.'
          );
          return;
        }

        const selected =
          data[0] as Puzzle;

        setPuzzle(selected);

        setGrid(
          Array.from(
            { length: selected.rows },
            () =>
              Array(selected.cols).fill(0)
          )
        );

        setHistory([]);
        setSeconds(0);
        setAnswerName('');
        setBestTime(null);
        setNotice('');
        setScreen('game');
      });
  }, [supabase]);

  useEffect(() => {
    if (screen !== 'game') {
      return;
    }

    const id = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () =>
      window.clearInterval(id);
  }, [screen]);

  useEffect(() => {
    const stopDrag = () =>
      setDrag(false);

    window.addEventListener(
      'pointerup',
      stopDrag
    );

    return () =>
      window.removeEventListener(
        'pointerup',
        stopDrag
      );
  }, []);

  const formatTime = (value: number) =>
    `${String(
      Math.floor(value / 60)
    ).padStart(2, '0')}:${String(
      value % 60
    ).padStart(2, '0')}`;

  const formatNo = (number: number) =>
    `#${String(number).padStart(
      6,
      '0'
    )}`;

  const isMobile = () =>
    window.matchMedia(
      '(max-width:767px) and (pointer:coarse)'
    ).matches;

  async function authSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setNotice('');

    const result =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword(
            {
              email,
              password,
            }
          )
        : await supabase.auth.signUp({
            email,
            password,
          });

    setLoading(false);

    if (result.error) {
      setNotice(
        result.error.message
      );
      return;
    }

    if (
      authMode === 'signup' &&
      !result.data.session
    ) {
      setNotice(
        '인증 메일을 확인해 주세요.'
      );
      return;
    }

    setNotice('로그인되었습니다.');

    if (result.data.session) {
      window.setTimeout(
        () => setLoginOpen(false),
        500
      );
    }
  }

  async function loadPuzzle(
    level: Difficulty
  ) {
    if (
      level === 'expert' &&
      isMobile()
    ) {
      setNotice(
        '초고수 난이도는 PC에서만 플레이할 수 있어요.'
      );
      return;
    }

    setLoading(true);
    setNotice(
      '문제를 불러오는 중입니다.'
    );

    const { data, error } =
      await supabase.rpc(
        'get_random_puzzle',
        {
          target_difficulty: level,
          target_user_id:
            user?.id ?? null,
        }
      );

    setLoading(false);

    if (error) {
      setNotice(
        `문제를 불러오지 못했어요: ${error.message}`
      );
      return;
    }

    const selected =
      data?.[0] as
        | Puzzle
        | undefined;

    if (!selected) {
      setNotice(
        '아직 이 난이도에 등록된 문제가 없어요.'
      );
      return;
    }

    setPuzzle(selected);

    setGrid(
      Array.from(
        { length: selected.rows },
        () =>
          Array(
            selected.cols
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

  function setCell(
    row: number,
    column: number,
    value: CellState
  ) {
    setGrid((previous) => {
      if (
        previous[row][column] ===
        value
      ) {
        return previous;
      }

      setHistory((items) => [
        ...items.slice(-49),
        previous.map((line) => [
          ...line,
        ]),
      ]);

      return previous.map(
        (line, rowIndex) =>
          line.map(
            (
              cell,
              columnIndex
            ) =>
              rowIndex === row &&
              columnIndex ===
                column
                ? value
                : cell
          )
      ) as CellState[][];
    });
  }

  function pointerDown(
    row: number,
    column: number
  ) {
    const value: CellState =
      grid[row][column] === tool
        ? 0
        : tool;

    dragValue.current = value;
    setDrag(true);

    setCell(
      row,
      column,
      value
    );
  }

  function undo() {
    const previous =
      history.at(-1);

    if (!previous) {
      return;
    }

    setGrid(previous);

    setHistory((items) =>
      items.slice(0, -1)
    );
  }

  async function submitAnswer() {
    if (!puzzle) {
      return;
    }

    setLoading(true);
    setNotice(
      '정답을 확인하는 중입니다.'
    );

    const solution = grid.map(
      (row) =>
        row.map((cell) =>
          cell === 1 ? 1 : 0
        )
    );

    const request = user
      ? supabase.rpc(
          'complete_puzzle',
          {
            target_puzzle_id:
              puzzle.id,
            submitted_solution:
              solution,
            submitted_elapsed_seconds:
              seconds,
            submitted_mistakes:
              0,
          }
        )
      : supabase.rpc(
          'check_puzzle_answer',
          {
            target_puzzle_id:
              puzzle.id,
            submitted_solution:
              solution,
          }
        );

    const { data, error } =
      await request;

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

    setAnswerName(
      result.answer_name
    );

    setBestTime(
      result.best_time_seconds ??
        null
    );

    setNotice('');
    setScreen('result');
  }

  async function sharePuzzle() {
    if (!puzzle) {
      return;
    }

    const url =
      `${location.origin}/?puzzle=${puzzle.puzzle_no}`;

    const text =
      `월루로직 ${formatNo(
        puzzle.puzzle_no
      )}에 도전해보세요.`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            '월루로직',
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(
          url
        );

        setNotice(
          '문제 링크를 복사했어요.'
        );
      }
    } catch {
      // 사용자가 공유 창을 닫은 경우
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() =>
            setScreen('home')
          }
        >
          월루로직
        </button>

        <div>
          {user ? (
            <>
              <span className="userMail">
                {user.email}
              </span>

              <button
                className="subtle"
                onClick={() =>
                  supabase.auth.signOut()
                }
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              className="subtle"
              onClick={() =>
                setLoginOpen(true)
              }
            >
              로그인
            </button>
          )}
        </div>
      </header>

      {screen === 'home' && (
        <section className="home screen">
          <h1>월루로직</h1>

          <div className="homeIllustration">
            <img
              src="/illustrations/home-cat.png"
              alt=""
              aria-hidden="true"
            />
          </div>

          <button
            className="primary"
            onClick={() =>
              setScreen('guide')
            }
          >
            월루 시작
            <span>→</span>
          </button>
        </section>
      )}

      {screen === 'guide' && (
        <section className="guide screen">
          <button
            className="close"
            aria-label="닫기"
            onClick={() =>
              setScreen('levels')
            }
          >
            ×
          </button>

          <h2>
            네모로직,
            <br />
            이렇게 풀어요
          </h2>

          <div className="guideHero">
            <img
              src="/illustrations/guide-cat.png"
              alt=""
              aria-hidden="true"
            />
          </div>

          <div className="steps">
            <article>
              <b>1</b>

              <div>
                <h3>
                  숫자 힌트를
                  확인하세요
                </h3>

                <p>
                  각 행과 열의
                  숫자는 연속해서
                  채워야 하는 칸의
                  개수예요.
                </p>
              </div>
            </article>

            <article>
              <b>2</b>

              <div>
                <h3>
                  칸을 채우거나
                  X로 표시하세요
                </h3>

                <p>
                  숫자에 해당하는
                  칸은 채우고,
                  비어 있다고
                  판단한 칸은 X로
                  표시해요.
                </p>

                <div className="states">
                  <i className="filled" />
                  <span>→</span>
                  <i className="cross">
                    ×
                  </i>
                  <span>→</span>
                  <i />
                </div>
              </div>
            </article>

            <article>
              <b>3</b>

              <div>
                <h3>
                  모든 조건을
                  맞추면 완료
                </h3>

                <p>
                  행과 열의 조건을
                  모두 맞추면
                  숨겨진 그림이
                  공개돼요.
                </p>
              </div>
            </article>
          </div>

          <button
            className="primary"
            onClick={() =>
              setScreen('levels')
            }
          >
            확인했어요
          </button>
        </section>
      )}

      {screen === 'levels' && (
        <section className="levels screen">
          <button
            className="back"
            onClick={() =>
              setScreen('home')
            }
          >
            ←
          </button>

          <h2>
            난이도를 선택하세요
          </h2>

          <div className="levelList">
            {(
              Object.keys(
                LEVELS
              ) as Difficulty[]
            ).map((key) => {
              const level =
                LEVELS[key];

              return (
                <button
                  key={key}
                  className={`levelCard ${
                    level.pcOnly
                      ? 'expert'
                      : ''
                  }`}
                  onClick={() =>
                    loadPuzzle(key)
                  }
                  disabled={loading}
                >
                  <span className="levelIllustration">
                    <img
                      src={
                        LEVEL_ILLUSTRATIONS[
                          key
                        ]
                      }
                      alt=""
                      aria-hidden="true"
                    />
                  </span>

                  <span className="levelText">
                    <b>
                      {level.title}
                    </b>

                    <small>
                      {
                        level.description
                      }
                    </small>

                    {level.pcOnly && (
                      <em>
                        PC 전용
                      </em>
                    )}
                  </span>

                  <strong>
                    ›
                  </strong>
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

      {screen === 'game' &&
        puzzle && (
          <section className="game screen">
            <div className="gameHead">
              <button
                className="back"
                onClick={() =>
                  setScreen(
                    'levels'
                  )
                }
              >
                ←
              </button>

              <div>
                <b>
                  {formatNo(
                    puzzle.puzzle_no
                  )}
                </b>

                <small>
                  {
                    LEVELS[
                      puzzle
                        .difficulty
                    ].title
                  }
                </small>
              </div>

              <time>
                {formatTime(
                  seconds
                )}
              </time>
            </div>

            <div className="boardScroll">
              <div
                className="boardWrap"
                style={
                  {
                    '--rows':
                      puzzle.rows,
                    '--cols':
                      puzzle.cols,
                  } as React.CSSProperties
                }
              >
                <div />

                <div className="colHints">
                  {puzzle.column_hints.map(
                    (
                      hints,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                      >
                        {hints.map(
                          (
                            number,
                            hintIndex
                          ) => (
                            <span
                              key={
                                hintIndex
                              }
                            >
                              {
                                number
                              }
                            </span>
                          )
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="rowHints">
                  {puzzle.row_hints.map(
                    (
                      hints,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                      >
                        {hints.map(
                          (
                            number,
                            hintIndex
                          ) => (
                            <span
                              key={
                                hintIndex
                              }
                            >
                              {
                                number
                              }
                            </span>
                          )
                        )}
                      </div>
                    )
                  )}
                </div>

                <div
                  className="board"
                  onContextMenu={(
                    event
                  ) =>
                    event.preventDefault()
                  }
                >
                  {grid.map(
                    (row, r) =>
                      row.map(
                        (
                          cell,
                          c
                        ) => (
                          <button
                            type="button"
                            aria-label={`${r + 1}행 ${c + 1}열`}
                            key={`${r}-${c}`}
                            className={`cell ${
                              cell ===
                              1
                                ? 'filled'
                                : cell ===
                                  2
                                ? 'cross'
                                : ''
                            }`}
                            onPointerDown={(
                              event
                            ) => {
                              event.preventDefault();

                              pointerDown(
                                r,
                                c
                              );
                            }}
                            onPointerEnter={() =>
                              drag &&
                              setCell(
                                r,
                                c,
                                dragValue.current
                              )
                            }
                          />
                        )
                      )
                  )}
                </div>
              </div>
            </div>

            <div className="tools">
              <button
                className={
                  tool === 1
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTool(1)
                }
              >
                <i className="toolFill" />
                채우기
              </button>

              <button
                className={
                  tool === 2
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTool(2)
                }
              >
                <i className="toolX">
                  ×
                </i>
                X 표시
              </button>

              <button
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
              className="primary"
              onClick={
                submitAnswer
              }
              disabled={loading}
            >
              {loading
                ? '확인 중'
                : '정답 확인'}
            </button>
          </section>
        )}

      {screen === 'result' &&
        puzzle && (
          <section className="result screen">
            <img
              className="resultIllustration"
              src="/illustrations/complete-cat.png"
              alt=""
              aria-hidden="true"
            />

            <h2>완성!</h2>

            <h3>
              {answerName}
            </h3>

            <p>
              문제{' '}
              {formatNo(
                puzzle.puzzle_no
              )}
            </p>

            <div className="resultStats">
              <span>
                소요 시간
                <strong>
                  {formatTime(
                    seconds
                  )}
                </strong>
              </span>

              <span>
                난이도
                <strong>
                  {
                    LEVELS[
                      puzzle
                        .difficulty
                    ].title
                  }
                </strong>
              </span>

              {bestTime !==
                null && (
                <span>
                  최고 기록
                  <strong>
                    {formatTime(
                      bestTime
                    )}
                  </strong>
                </span>
              )}
            </div>

            {!user && (
              <button
                className="loginNudge"
                onClick={() =>
                  setLoginOpen(
                    true
                  )
                }
              >
                로그인하고
                기록 저장하기
              </button>
            )}

            <button
              className="primary"
              onClick={() =>
                loadPuzzle(
                  puzzle.difficulty
                )
              }
            >
              같은 난이도
              새 문제
            </button>

            <button
              className="secondary"
              onClick={
                sharePuzzle
              }
            >
              문제 공유
            </button>

            <button
              className="textButton"
              onClick={() =>
                setScreen(
                  'levels'
                )
              }
            >
              다른 난이도 선택
            </button>

            <p className="notice">
              {notice}
            </p>
          </section>
        )}

      {loginOpen && (
        <div
          className="modalBackdrop"
          onMouseDown={(
            event
          ) =>
            event.target ===
              event.currentTarget &&
            setLoginOpen(
              false
            )
          }
        >
          <section className="authModal">
            <button
              className="close"
              onClick={() =>
                setLoginOpen(
                  false
                )
              }
            >
              ×
            </button>

            <h2>
              {authMode ===
              'login'
                ? '로그인'
                : '회원가입'}
            </h2>

            <p>
              로그인하면 완료
              기록과 최고 기록을
              저장할 수 있어요.
            </p>

            <form
              onSubmit={
                authSubmit
              }
            >
              <label>
                이메일

                <input
                  type="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                  }
                  required
                  autoComplete="email"
                />
              </label>

              <label>
                비밀번호

                <input
                  type="password"
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event
                        .target
                        .value
                    )
                  }
                  required
                  minLength={6}
                  autoComplete={
                    authMode ===
                    'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                />
              </label>

              <button
                className="primary"
                disabled={
                  loading
                }
              >
                {loading
                  ? '처리 중'
                  : authMode ===
                    'login'
                  ? '로그인'
                  : '가입하기'}
              </button>
            </form>

            <button
              className="textButton"
              onClick={() => {
                setAuthMode(
                  (mode) =>
                    mode ===
                    'login'
                      ? 'signup'
                      : 'login'
                );

                setNotice('');
              }}
            >
              {authMode ===
              'login'
                ? '계정이 없나요? 회원가입'
                : '이미 계정이 있나요? 로그인'}
            </button>

            <p className="notice">
              {notice}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
