import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/format';
import { MessageSquare, Search, Send } from 'lucide-react';

const bubbleBase = 'max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line';

const MessageList: React.FC<{ messages: ReturnType<typeof useApp>['chatMessages']; mine: (senderRole: string) => boolean }> = ({
  messages,
  mine
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        لا توجد رسائل بعد. ابدأ المحادثة بالأسفل.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
      {messages.map(m => {
        const isMine = mine(m.senderRole);
        return (
          <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
            <div
              className={`${bubbleBase} ${
                isMine
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 px-1">
              {isMine ? '' : `${m.senderName} · `}
              {formatDateTime(m.createdAt)}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

/** Student: chat with each doctor they're enrolled with about a question or a problem with the explanation. */
export const StudentChatPage: React.FC = () => {
  const { getChatDoctors, getChatThread, sendChatMessage, markChatRead } = useApp();
  const doctors = getChatDoctors();
  const [activeDoctorId, setActiveDoctorId] = useState(doctors[0]?.doctorId || '');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!activeDoctorId && doctors[0]) setActiveDoctorId(doctors[0].doctorId);
  }, [doctors, activeDoctorId]);

  useEffect(() => {
    if (activeDoctorId) markChatRead(activeDoctorId);
  }, [activeDoctorId]);

  if (doctors.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-400" />
          سجّل في مقرر أولاً حتى تقدر تتواصل مع دكتوره.
        </div>
      </div>
    );
  }

  const messages = activeDoctorId ? getChatThread(activeDoctorId) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeDoctorId) return;
    sendChatMessage({ doctorId: activeDoctorId, text });
    setText('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4 h-[calc(100vh-4rem)] flex flex-col">
      <div className="shrink-0">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">تواصل مع الدكتور</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">لأي سؤال أو مشكلة في الشرح، راسل الدكتور مباشرة من هنا.</p>
      </div>

      {doctors.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin shrink-0">
          {doctors.map(d => (
            <button
              key={d.doctorId}
              onClick={() => setActiveDoctorId(d.doctorId)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                d.doctorId === activeDoctorId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {d.doctorName}
            </button>
          ))}
        </div>
      )}

      <div className="surface flex-1 flex flex-col overflow-hidden">
        <MessageList messages={messages} mine={role => role === 'student'} />
        <form onSubmit={submit} className="border-t border-slate-100 dark:border-slate-800 p-3 flex items-center gap-2 shrink-0">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="اكتب سؤالك أو مشكلتك..."
            className="flex-1 text-sm p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shrink-0"
            aria-label="إرسال"
          >
            <Send className="w-4 h-4 -scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
};

/** Doctor / assistant: every student's question/problem thread, in one inbox. */
export const StaffChatPage: React.FC = () => {
  const { getChatThreadsForStaff, sendChatMessage, markChatRead, doctorScopeId } = useApp();
  const threads = getChatThreadsForStaff();
  const [activeStudentId, setActiveStudentId] = useState('');
  const [q, setQ] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!activeStudentId && threads[0]) setActiveStudentId(threads[0].studentId);
  }, [threads, activeStudentId]);

  useEffect(() => {
    if (activeStudentId && doctorScopeId) markChatRead(doctorScopeId, activeStudentId);
  }, [activeStudentId, doctorScopeId]);

  const active = threads.find(t => t.studentId === activeStudentId);
  const filtered = threads.filter(t => !q || t.studentName.includes(q));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeStudentId || !doctorScopeId) return;
    sendChatMessage({ doctorId: doctorScopeId, studentId: activeStudentId, text });
    setText('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4 h-[calc(100vh-4rem)] flex flex-col">
      <div className="shrink-0">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">المحادثات</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">أسئلة الطلبة ومشاكلهم في الشرح، مرسلة من داخل المنصة.</p>
      </div>

      {threads.length === 0 ? (
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-400" />
          لا توجد محادثات بعد.
        </div>
      ) : (
        <div className="surface flex-1 flex overflow-hidden">
          <div className="w-64 shrink-0 border-e border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-[1.15rem] start-5" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="بحث عن طالب"
                className="w-full text-xs ps-7 pe-2 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(t => (
                <button
                  key={t.studentId}
                  onClick={() => setActiveStudentId(t.studentId)}
                  className={`w-full text-start p-3 flex items-center justify-between gap-2 ${
                    t.studentId === activeStudentId ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{t.studentName}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t.messages[t.messages.length - 1]?.text}
                    </div>
                  </div>
                  {t.unread > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      {t.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {active ? (
              <>
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{active.studentName}</div>
                </div>
                <MessageList messages={active.messages} mine={role => role !== 'student'} />
                <form onSubmit={submit} className="border-t border-slate-100 dark:border-slate-800 p-3 flex items-center gap-2 shrink-0">
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="اكتب ردك..."
                    className="flex-1 text-sm p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shrink-0"
                    aria-label="إرسال"
                  >
                    <Send className="w-4 h-4 -scale-x-100" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">اختر محادثة</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
