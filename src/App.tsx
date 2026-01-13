import { useState } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PostComposer } from './components/PostComposer';
import { StatusMonitor } from './components/StatusMonitor';
import { HistoryGrid } from './components/HistoryGrid';
import type { ImageFile } from './utils/imageUtils';
import { useAutoPost } from './hooks/useAutoPost';

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [text, setText] = useState<string>('');

  const [scheduledInput, setScheduledInput] = useState<string>('');

  const {
    isPosting,
    groups,
    currentGroupIndex,
    history,
    startPosting,
    deleteHistory,
    clearHistory,
    isScheduled,
    scheduledTime,
    cancelSchedule
  } = useAutoPost();

  const handlePost = () => {
    if (images.length === 0) return alert('画像を1枚以上選択してください');

    let msg = '自動投稿を開始しますか？';
    let scheduleDate: Date | undefined = undefined;

    if (scheduledInput) {
      scheduleDate = new Date(scheduledInput);
      msg = `${scheduleDate.toLocaleString()} に自動投稿を予約しますか？`;
    }

    if (!confirm(msg)) return;

    startPosting(text, images, scheduleDate);
  };

  const handleReset = () => {
    if (confirm('入力内容をリセットしますか？')) {
      setImages([]);
      setText('');
    }
  };

  return (
    <div className="min-h-screen pb-20 font-sans">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          <div className="col-span-1 lg:col-span-2 space-y-8">
            {/* Image Upload Area */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6">
              <ImageUploader images={images} setImages={setImages} />
            </div>

            {/* Text Input Area */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6">
              <PostComposer text={text} setText={setText} />
            </div>


            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
              <div className="bg-white/50 p-4 rounded-xl border border-white/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-bold whitespace-nowrap">予約投稿 (任意):</span>
                  <input
                    type="datetime-local"
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-pop-cyan outline-none bg-white/80"
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setScheduledInput('');
                        return;
                      }
                      const selected = new Date(val);
                      const now = new Date();
                      if (selected < now) {
                        alert('現在時刻より前の日時は指定できません');
                        e.target.value = '';
                        setScheduledInput('');
                      } else {
                        setScheduledInput(val);
                      }
                    }}
                  />
                </div>
                {isScheduled && (
                  <span className="text-pop-magenta font-bold animate-pulse text-sm">
                    {new Date(scheduledTime!).toLocaleString()} に予約待機中...
                  </span>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePost}
                  disabled={isPosting || isScheduled || images.length === 0}
                  className={`flex-1 font-bold py-4 rounded-xl transition-all shadow-lg ${isPosting || isScheduled || images.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5 hover:shadow-pop-cyan/50'
                    }`}
                >
                  {isPosting ? '自動投稿を実行中...' : isScheduled ? '予約待機中...' : '自動投稿を開始する'}
                </button>
                {(isPosting || isScheduled) && (
                  <button
                    onClick={() => {
                      if (confirm('投稿予約/処理を中断しますか？')) {
                        cancelSchedule();
                        // Force reload or reset state if strictly needed, but cancelSchedule halts the timer.
                        // Ideally reset local state too if needed, but cancelSchedule updates isScheduled.
                      }
                    }}
                    className="px-6 py-4 rounded-xl font-bold bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    中断
                  </button>
                )}
                {!isPosting && !isScheduled && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-4 rounded-xl font-bold bg-white/90 border border-gray-300 hover:bg-white transition-colors text-gray-700 disabled:opacity-50"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-1 space-y-8">
            {/* Sidebar: Status */}
            <div className="lg:sticky lg:top-24">
              <StatusMonitor
                groups={groups}
                isPosting={isPosting}
                currentGroupIndex={currentGroupIndex}
                history={history}
              />
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">投稿履歴</h2>
          <HistoryGrid
            history={history}
            onDelete={deleteHistory}
            onClear={clearHistory}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
