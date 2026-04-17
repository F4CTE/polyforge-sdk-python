import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Users, ChevronLeft, ChevronRight, Trophy,
  MessageCircle, Share2, Send, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface FeedActor {
  username: string;
  displayName: string | null;
  avatarUrl?: string;
}

interface FeedItem {
  id: string;
  type: 'ORDER_FILLED' | 'STRATEGY_CREATED' | 'POSITION_CLOSED' | 'BACKTEST_COMPLETED';
  actor: FeedActor;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface FeedResponse {
  data: FeedItem[];
  total: number;
  totalPages: number;
}

type ReactionEmoji = '👍' | '🔥' | '💎' | '🎯' | '😮';

interface Reaction {
  emoji: ReactionEmoji;
  count: number;
  userReacted: boolean;
}

interface FeedComment {
  id: string;
  authorUsername: string;
  authorInitials: string;
  body: string;
  createdAt: string;
  likeCount: number;
  userLiked: boolean;
}

interface FeedItemEnhanced extends FeedItem {
  reactions: Reaction[];
  commentCount: number;
  comments: FeedComment[];
  commentsLoaded: boolean;
  shareCount: number;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '🔥', '💎', '🎯', '😮'];

const DEFAULT_REACTIONS: Reaction[] = REACTION_EMOJIS.map(emoji => ({
  emoji,
  count: 0,
  userReacted: false,
}));

/* ─── Helpers ────────────────────────────────────────────────────────── */

function activityDescription(item: FeedItem): string {
  const p = item.payload;
  switch (item.type) {
    case 'ORDER_FILLED': {
      const side = typeof p.side === 'string' ? p.side : '';
      const outcome = typeof p.outcome === 'string' ? p.outcome : '';
      const marketTitle = typeof p.marketTitle === 'string' ? p.marketTitle : 'a market';
      const base = `placed a ${side} ${outcome} order on ${marketTitle}`.trim();
      if (typeof p.pnl === 'number' || typeof p.pnl === 'string') {
        return `${base} · P&L: ${p.pnl}`;
      }
      return base;
    }
    case 'STRATEGY_CREATED': {
      const name = typeof p.strategyName === 'string' ? p.strategyName : 'a strategy';
      return `created a new strategy: ${name}`;
    }
    case 'POSITION_CLOSED': {
      const pnl = typeof p.pnl === 'number' || typeof p.pnl === 'string' ? p.pnl : 'unknown';
      return `closed position with ${pnl} P&L`;
    }
    case 'BACKTEST_COMPLETED': {
      const winRate = typeof p.winRate === 'number' || typeof p.winRate === 'string' ? p.winRate : '?';
      return `completed a backtest with ${winRate}% win rate`;
    }
    default:
      return 'performed an action';
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toEnhanced(item: FeedItem): FeedItemEnhanced {
  return {
    ...item,
    reactions: DEFAULT_REACTIONS.map(r => ({ ...r })),
    commentCount: 0,
    comments: [],
    commentsLoaded: false,
    shareCount: 0,
  };
}

function Initials({ actor }: { actor: FeedActor }) {
  const label = (actor.displayName ?? actor.username).slice(0, 2).toUpperCase();
  return (
    <div className="size-9 rounded-full bg-surface flex items-center justify-center text-body-md font-semibold text-accent-text shrink-0">
      {label}
    </div>
  );
}

function CommentAvatar({ initials }: { initials: string }) {
  return (
    <div className="size-7 rounded-full bg-elevated border border-default flex items-center justify-center text-caption font-semibold text-secondary shrink-0">
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-subtle last:border-b-0">
      <div className="size-9 rounded-full bg-overlay animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 bg-overlay rounded animate-pulse" />
        <div className="h-3 w-64 bg-overlay rounded animate-pulse" />
        <div className="h-3 w-16 bg-overlay rounded animate-pulse" />
      </div>
    </div>
  );
}

function CommentSkeletonRow() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      <div className="size-7 rounded-full bg-overlay shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 bg-overlay rounded" />
        <div className="h-3 w-48 bg-overlay rounded" />
      </div>
    </div>
  );
}

/* ─── Emoji Picker ───────────────────────────────────────────────────── */

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: ReactionEmoji) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-1 px-2 py-2 bg-surface border border-default rounded-pf shadow-lg z-10"
      role="toolbar"
      aria-label="Pick a reaction"
    >
      {REACTION_EMOJIS.map(emoji => (
        <Button
          key={emoji}
          type="button"
          variant="ghost"
          onClick={() => { onSelect(emoji); onClose(); }}
          className="text-base leading-none p-1 rounded hover:bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}

/* ─── Comment Section ────────────────────────────────────────────────── */

function CommentSection({
  itemId,
  commentCount,
  comments,
  commentsLoaded,
  loadingComments,
  commentInput,
  onLoadMore,
  onInputChange,
  onSubmit,
  onLikeComment,
}: {
  itemId: string;
  commentCount: number;
  comments: FeedComment[];
  commentsLoaded: boolean;
  loadingComments: boolean;
  commentInput: string;
  onLoadMore: () => void;
  onInputChange: (val: string) => void;
  onSubmit: () => void;
  onLikeComment: (commentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  const remaining = commentCount - comments.length;

  return (
    <div className="mt-3 pt-3 border-t border-subtle space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-label font-medium text-secondary">
        <MessageCircle className="size-4 text-accent-text" aria-hidden="true" />
        <span>Comments ({commentCount})</span>
      </div>

      {/* Loading skeleton */}
      {loadingComments && (
        <div className="space-y-3">
          <CommentSkeletonRow />
          <CommentSkeletonRow />
        </div>
      )}

      {/* Comment list */}
      {!loadingComments && commentsLoaded && (
        <ul className="space-y-3" role="list" aria-label="Comments">
          {comments.map(comment => (
            <li key={comment.id} className="flex items-start gap-3">
              <CommentAvatar initials={comment.authorInitials} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-label font-semibold text-primary">@{comment.authorUsername}</span>
                  <time
                    className="text-caption text-tertiary"
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                  >
                    {relativeTime(comment.createdAt)}
                  </time>
                </div>
                <p className="text-label text-secondary mt-1 leading-relaxed break-words">
                  {comment.body}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onLikeComment(comment.id)}
                  aria-label={comment.userLiked ? 'Unlike comment' : 'Like comment'}
                  className={`mt-1 flex items-center gap-1 text-caption rounded px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    comment.userLiked
                      ? 'text-accent-text bg-accent/10'
                      : 'text-tertiary hover:text-secondary'
                  }`}
                >
                  👍 {comment.likeCount}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Load more */}
      {commentsLoaded && remaining > 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={onLoadMore}
          className="flex items-center gap-1 text-label text-accent-text hover:text-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label={`Load ${remaining} more comment${remaining !== 1 ? 's' : ''}`}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
          Show {remaining} more comment{remaining !== 1 ? 's' : ''}
        </Button>
      )}

      {/* Comment input */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="text"
          value={commentInput}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          aria-label={`Add a comment to post ${itemId}`}
          className="flex-1 min-w-0 bg-surface border border-default rounded-pf px-3 py-2 text-label text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-1 focus-visible:ring-accent/30 transition-colors"
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!commentInput.trim()}
          aria-label="Post comment"
          className="flex items-center gap-1 px-3 py-2 rounded-pf bg-accent-subtle text-accent-text border border-accent/30 hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed text-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 shrink-0"
        >
          <Send className="size-3" aria-hidden="true" />
          Post
        </Button>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [items, setItems] = useState<FeedItemEnhanced[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasFollows, setHasFollows] = useState<boolean | null>(null);

  // Social interaction state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [pickerOpen, setPickerOpen] = useState<string | null>(null); // item id or null

  const LIMIT = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/v1/feed?page=${page}&limit=${LIMIT}`, { credentials: 'include' });
        if (!res.ok) {
          toast.error('Failed to load feed');
          return;
        }
        const json: FeedResponse = await res.json();
        if (!cancelled) {
          setItems((json.data ?? []).map(toEnhanced));
          setTotal(json.total ?? 0);
          setTotalPages(json.totalPages ?? 1);
          if (page === 1 && (json.data ?? []).length === 0) {
            try {
              const followRes = await fetch('/api/v1/users/me/following?limit=1', { credentials: 'include' });
              if (!cancelled) {
                if (followRes.ok) {
                  const followData = await followRes.json();
                  const count = followData.total ?? followData.data?.length ?? 0;
                  setHasFollows(count > 0);
                } else {
                  setHasFollows(false);
                }
              }
            } catch {
              if (!cancelled) setHasFollows(false);
            }
          } else {
            if (!cancelled) setHasFollows(true);
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [page]);

  /* ── Reaction handlers ─────────────────────────────────────────────── */

  const handleReact = useCallback(async (itemId: string, emoji: ReactionEmoji) => {
    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const reactions = item.reactions.map(r => {
        if (r.emoji !== emoji) return r;
        const nowReacted = !r.userReacted;
        return {
          ...r,
          userReacted: nowReacted,
          count: r.count + (nowReacted ? 1 : -1),
        };
      });
      return { ...item, reactions };
    }));

    try {
      const res = await fetch(`/api/v1/feed/${itemId}/react`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error('reaction failed');
    } catch {
      // Roll back
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const reactions = item.reactions.map(r => {
          if (r.emoji !== emoji) return r;
          const rolledBack = !r.userReacted;
          return {
            ...r,
            userReacted: rolledBack,
            count: r.count + (rolledBack ? 1 : -1),
          };
        });
        return { ...item, reactions };
      }));
      toast.error('Failed to update reaction');
    }
  }, []);

  /* ── Comment expansion & loading ───────────────────────────────────── */

  const handleToggleComments = useCallback(async (itemId: string, alreadyLoaded: boolean) => {
    const isExpanded = expandedComments[itemId] ?? false;

    if (isExpanded) {
      setExpandedComments(prev => ({ ...prev, [itemId]: false }));
      return;
    }

    setExpandedComments(prev => ({ ...prev, [itemId]: true }));

    if (alreadyLoaded) return;

    setLoadingComments(prev => ({ ...prev, [itemId]: true }));

    try {
      const res = await fetch(`/api/v1/feed/${itemId}/comments?limit=10`, { credentials: 'include' });
      if (!res.ok) throw new Error('comments fetch failed');
      const json: { data: FeedComment[]; total: number } = await res.json();
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          comments: json.data ?? [],
          commentCount: json.total ?? item.commentCount,
          commentsLoaded: true,
        };
      }));
    } catch {
      toast.error('Failed to load comments');
      setExpandedComments(prev => ({ ...prev, [itemId]: false }));
    } finally {
      setLoadingComments(prev => ({ ...prev, [itemId]: false }));
    }
  }, [expandedComments]);

  const handleLoadMoreComments = useCallback(async (itemId: string, currentCount: number) => {
    setLoadingComments(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(
        `/api/v1/feed/${itemId}/comments?limit=10&offset=${currentCount}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('load more failed');
      const json: { data: FeedComment[]; total: number } = await res.json();
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          comments: [...item.comments, ...(json.data ?? [])],
          commentCount: json.total ?? item.commentCount,
        };
      }));
    } catch {
      toast.error('Failed to load more comments');
    } finally {
      setLoadingComments(prev => ({ ...prev, [itemId]: false }));
    }
  }, []);

  /* ── Post comment ──────────────────────────────────────────────────── */

  const handlePostComment = useCallback(async (itemId: string) => {
    const body = (commentInputs[itemId] ?? '').trim();
    if (!body) return;

    // Optimistic append
    const optimisticComment: FeedComment = {
      id: `optimistic-${Date.now()}`,
      authorUsername: 'you',
      authorInitials: 'YO',
      body,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      userLiked: false,
    };

    setCommentInputs(prev => ({ ...prev, [itemId]: '' }));
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        comments: [...item.comments, optimisticComment],
        commentCount: item.commentCount + 1,
      };
    }));

    try {
      const res = await fetch(`/api/v1/feed/${itemId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('post comment failed');
      const real: FeedComment = await res.json();
      // Replace optimistic with real
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          comments: item.comments.map(c =>
            c.id === optimisticComment.id ? real : c
          ),
        };
      }));
    } catch {
      // Roll back
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          comments: item.comments.filter(c => c.id !== optimisticComment.id),
          commentCount: item.commentCount - 1,
        };
      }));
      setCommentInputs(prev => ({ ...prev, [itemId]: body }));
      toast.error('Failed to post comment');
    }
  }, [commentInputs]);

  /* ── Like comment ──────────────────────────────────────────────────── */

  const handleLikeComment = useCallback(async (itemId: string, commentId: string) => {
    // Optimistic
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        comments: item.comments.map(c => {
          if (c.id !== commentId) return c;
          const nowLiked = !c.userLiked;
          return { ...c, userLiked: nowLiked, likeCount: c.likeCount + (nowLiked ? 1 : -1) };
        }),
      };
    }));

    try {
      const res = await fetch(`/api/v1/feed/${itemId}/comments/${commentId}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('like failed');
    } catch {
      // Roll back
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          comments: item.comments.map(c => {
            if (c.id !== commentId) return c;
            const rolled = !c.userLiked;
            return { ...c, userLiked: rolled, likeCount: c.likeCount + (rolled ? 1 : -1) };
          }),
        };
      }));
      toast.error('Failed to like comment');
    }
  }, []);

  /* ── Share to profile ──────────────────────────────────────────────── */

  const handleShare = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/v1/feed/${itemId}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('share failed');
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, shareCount: item.shareCount + 1 } : item
      ));
      toast.success('Shared to your profile!');
    } catch {
      toast.error('Failed to share post');
    }
  }, []);

  /* ── Pagination ────────────────────────────────────────────────────── */

  function handlePrev() {
    if (page > 1) setPage(p => p - 1);
  }

  function handleNext() {
    if (page < totalPages) setPage(p => p + 1);
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Users className="size-5 text-accent-text shrink-0" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-primary">Following Feed</h1>
        {!loading && total > 0 && (
          <span className="ml-auto text-label text-tertiary">{total.toLocaleString()} item{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Feed card */}
      <div className="bg-elevated border border-default rounded-xl overflow-hidden">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : items.length === 0 ? (
          /* Empty states */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="size-10 text-tertiary mb-3" aria-hidden="true" />
            {hasFollows === false ? (
              <>
                <p className="text-body-md font-medium text-primary mb-1">You're not following anyone yet</p>
                <p className="text-label text-tertiary mb-4">
                  Follow traders to see their activity here.
                </p>
                <Link
                  to="/leaderboard"
                  className="flex items-center gap-2 px-4 py-2 rounded-pf bg-accent-subtle text-accent-text border border-accent/30 hover:bg-accent/25 text-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Trophy className="size-4" aria-hidden="true" />
                  Discover traders on the Leaderboard
                </Link>
              </>
            ) : (
              <>
                <p className="text-body-md font-medium text-primary mb-1">No recent activity</p>
                <p className="text-label text-tertiary">
                  No recent activity from traders you follow.
                </p>
              </>
            )}
          </div>
        ) : (
          /* Feed timeline */
          <ul className="divide-y divide-subtle" role="list">
            {items.map(item => {
              const actor = item.actor;
              const displayName = actor.displayName ?? actor.username;
              const isExpanded = expandedComments[item.id] ?? false;
              const commentInput = commentInputs[item.id] ?? '';
              const isLoadingComments = loadingComments[item.id] ?? false;
              const isPickerOpen = pickerOpen === item.id;
              const activeReactions = item.reactions.filter(r => r.count > 0);

              return (
                <li key={item.id} className="px-4 py-4 hover:bg-surface/40 transition-colors">
                  {/* Top row: avatar + content */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Link
                      to={`/profile/${actor.username}`}
                      aria-label={`View ${displayName}'s profile`}
                      className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-full"
                    >
                      {actor.avatarUrl ? (
                        <img
                          src={actor.avatarUrl}
                          alt={`${displayName} avatar`}
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <Initials actor={actor} />
                      )}
                    </Link>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link
                          to={`/profile/${actor.username}`}
                          className="text-body-md font-semibold text-primary hover:text-accent-text transition-colors focus-visible:outline-none focus-visible:underline"
                        >
                          {displayName}
                        </Link>
                        <span className="text-label text-tertiary">@{actor.username}</span>
                      </div>
                      <p className="text-label text-secondary mt-1 leading-relaxed">
                        {activityDescription(item)}
                      </p>
                      <time
                        className="text-caption text-tertiary mt-1 block"
                        dateTime={item.createdAt}
                        title={new Date(item.createdAt).toLocaleString()}
                      >
                        {relativeTime(item.createdAt)}
                      </time>
                    </div>
                  </div>

                  {/* Reactions bar */}
                  <div className="mt-3 flex items-center flex-wrap gap-2">
                    {activeReactions.map(r => (
                      <Button
                        key={r.emoji}
                        type="button"
                        variant="ghost"
                        onClick={() => handleReact(item.id, r.emoji)}
                        aria-pressed={r.userReacted}
                        aria-label={`${r.emoji} ${r.count} reaction${r.count !== 1 ? 's' : ''}${r.userReacted ? ', you reacted' : ''}`}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border text-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                          r.userReacted
                            ? 'bg-accent-subtle border-accent/40 text-accent-text'
                            : 'bg-elevated border-default text-secondary hover:border-strong hover:text-primary'
                        }`}
                      >
                        <span aria-hidden="true">{r.emoji}</span>
                        <span>{r.count}</span>
                      </Button>
                    ))}

                    {/* + React button / inline picker */}
                    <div className="relative">
                      {isPickerOpen ? (
                        <EmojiPicker
                          onSelect={emoji => handleReact(item.id, emoji)}
                          onClose={() => setPickerOpen(null)}
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setPickerOpen(item.id)}
                          aria-label="Add reaction"
                          aria-expanded={false}
                          className="flex items-center gap-1 px-2 py-1 rounded-full border border-default text-label text-tertiary hover:border-strong hover:text-secondary bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <span aria-hidden="true">+</span>
                          React
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-2 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleToggleComments(item.id, item.commentsLoaded)}
                      aria-expanded={isExpanded}
                      aria-controls={`comments-${item.id}`}
                      className={`flex items-center gap-2 text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded ${
                        isExpanded
                          ? 'text-accent-text'
                          : 'text-tertiary hover:text-secondary'
                      }`}
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      {item.commentCount > 0 ? `${item.commentCount} comment${item.commentCount !== 1 ? 's' : ''}` : 'Comment'}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleShare(item.id)}
                      className="flex items-center gap-2 text-label text-tertiary hover:text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
                    >
                      <Share2 className="size-4" aria-hidden="true" />
                      Share to profile
                      {item.shareCount > 0 && (
                        <span className="text-tertiary">({item.shareCount})</span>
                      )}
                    </Button>
                  </div>

                  {/* Comment section */}
                  {isExpanded && (
                    <div id={`comments-${item.id}`}>
                      <CommentSection
                        itemId={item.id}
                        commentCount={item.commentCount}
                        comments={item.comments}
                        commentsLoaded={item.commentsLoaded}
                        loadingComments={isLoadingComments}
                        commentInput={commentInput}
                        onLoadMore={() => handleLoadMoreComments(item.id, item.comments.length)}
                        onInputChange={val => setCommentInputs(prev => ({ ...prev, [item.id]: val }))}
                        onSubmit={() => handlePostComment(item.id)}
                        onLikeComment={commentId => handleLikeComment(item.id, commentId)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrev}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex items-center gap-2 px-3 py-2 rounded-pf text-label font-medium text-secondary border border-default hover:border-strong hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <span className="text-label text-tertiary">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={handleNext}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex items-center gap-2 px-3 py-2 rounded-pf text-label font-medium text-secondary border border-default hover:border-strong hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
