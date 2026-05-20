import React, { useState } from 'react';
import { Job, Candidate, Interview } from '../types';
import { 
  Calendar, 
  Clock, 
  FileText, 
  HelpCircle,
  PlusCircle, 
  Grid,
  CheckCircle, 
  Star,
  Award,
  X
} from 'lucide-react';

interface InterviewsViewProps {
  jobs: Job[];
  candidates: Candidate[];
  interviews: Interview[];
  onBookInterview: (meet: Partial<Interview>) => void;
  onSubmitFeedback: (meetId: string, rating: number, feedback: string) => void;
}

export default function InterviewsView({ jobs, candidates, interviews, onBookInterview, onSubmitFeedback }: InterviewsViewProps) {
  const [showBooking, setShowBooking] = useState(false);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);

  // Booking states
  const [targetCandId, setTargetCandId] = useState(candidates[0]?.id || '');
  const [targetJobId, setTargetJobId] = useState(jobs[0]?.id || '');
  const [dateInput, setDateInput] = useState('2026-05-25');
  const [timeInput, setTimeInput] = useState('10:00');
  const [typeInput, setTypeInput] = useState<'phone' | 'video' | 'in_person'>('video');
  const [interviewerInput, setInterviewerInput] = useState('Jane Doe (Senior HR)');

  // Feedback states
  const [feedScore, setFeedScore] = useState(5);
  const [feedText, setFeedText] = useState('');

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    onBookInterview({
      candidateId: targetCandId,
      jobId: targetJobId,
      date: dateInput,
      time: timeInput,
      type: typeInput,
      interviewer: interviewerInput,
      meetingLink: `https://meet.google.com/recruit-ai-${Math.random().toString(36).substr(2, 5)}`
    });
    setShowBooking(false);
  };

  const handleFeedbackSubmit = (meetId: string) => {
    onSubmitFeedback(meetId, feedScore, feedText);
    setActiveFeedbackId(null);
    setFeedText('');
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Interviews & Feedback Logs</h2>
          <p className="text-sm text-slate-500 font-sans">Book interview rounds, generate Google Meet links, and rate candidate performance.</p>
        </div>
        <button
          id="btn-book-interview"
          onClick={() => {
            if (candidates.length === 0) {
              alert("No candidates available to schedule. Please upload target resumes first!");
              return;
            }
            setTargetCandId(candidates[0]?.id || '');
            setTargetJobId(jobs[0]?.id || '');
            setShowBooking(true);
          }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" /> Book New Interview Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm">
        
        {/* Left Side: Scheduled Slots (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-950 text-sm">Active Agenda</h3>
          
          <div className="space-y-3.5">
            {interviews.length === 0 ? (
              <div className="text-center py-12 text-slate-450 text-slate-400 border border-dashed border-slate-150 rounded-xl font-sans">
                No interviews currently scheduled.
              </div>
            ) : (
              interviews.map(meet => {
                const cand = candidates.find(c => c.id === meet.candidateId);
                const job = jobs.find(j => j.id === meet.jobId);
                const isFeedbackThis = activeFeedbackId === meet.id;

                return (
                  <div key={meet.id} id={`meet-card-${meet.id}`} className="p-4 bg-slate-50 border border-slate-150 rounded-xl hover:border-slate-300 transition duration-150 space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono">
                          {meet.type} • {meet.status}
                        </span>
                        <h4 className="font-bold text-slate-950 text-sm mt-1">{cand?.name || 'Candidate profile'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-sans">{job?.title}</p>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-slate-900 block">{meet.date}</span>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-105 px-1.5 py-0.5 rounded block w-fit ml-auto mt-0.5">
                          {meet.time}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-650 flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 font-sans">
                      <span>Interviewer: <strong>{meet.interviewer}</strong></span>
                      {meet.meetingLink && (
                        <a href={meet.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                          Launch Meeting Room
                        </a>
                      )}
                    </div>

                    {meet.status === 'completed' && meet.rating && (
                      <div className="p-3 bg-blue-50 border border-blue-105 rounded-lg text-xs font-sans">
                        <div className="flex items-center gap-1 mb-1 text-blue-800">
                          <Award className="w-4 h-4 text-blue-600" />
                          <span className="font-bold">Score feedback submitted: {meet.rating}/5</span>
                        </div>
                        <p className="text-slate-600 italic">"{meet.feedback}"</p>
                      </div>
                    )}

                    {meet.status === 'scheduled' && !isFeedbackThis && (
                      <button
                        id={`btn-open-feedback-${meet.id}`}
                        onClick={() => setActiveFeedbackId(meet.id)}
                        className="text-xs font-bold text-blue-650 hover:text-blue-600 hover:underline cursor-pointer"
                      >
                        ✓ Post Consensus Evaluation Form Results
                      </button>
                    )}

                    {isFeedbackThis && (
                      <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-3 font-sans">
                        <span className="text-xs font-bold text-slate-505 block">Interview Verdict & Rating Matrix</span>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-600">Assigned Rating:</label>
                          {[1, 2, 3, 4, 5].map(num => (
                            <button
                              id={`rating-star-${meet.id}-${num}`}
                              key={num}
                              type="button"
                              onClick={() => setFeedScore(num)}
                              className={`p-0.5 hover:scale-105 transition`}
                            >
                              <Star className={`w-5 h-5 ${num <= feedScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                            </button>
                          ))}
                        </div>

                        <textarea
                          id={`feedback-text-area-${meet.id}`}
                          rows={3}
                          placeholder="Log detailed candidate strengths, overall design system understanding, or notable architectural flags..."
                          value={feedText}
                          onChange={(e) => setFeedText(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                        />

                        <div className="flex gap-2 justify-end">
                          <button
                            id={`cancel-feedback-${meet.id}`}
                            type="button"
                            onClick={() => {
                              setActiveFeedbackId(null);
                              setFeedText('');
                            }}
                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            id={`submit-feedback-${meet.id}`}
                            type="button"
                            onClick={() => handleFeedbackSubmit(meet.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            Submit Verdict
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Quick FAQ / Guidelines */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/60 p-6 space-y-4">
            <h4 className="font-bold text-slate-950 text-sm">Interviewer Core Guidelines</h4>
            <ul className="space-y-3.5 text-xs text-slate-600">
              <li className="flex gap-2 items-start leading-relaxed">
                <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                Validate algorithmic problem solving capabilities before checking educational alignments.
              </li>
              <li className="flex gap-2 items-start leading-relaxed">
                <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                Score transparently out of 5 based on technical communication and system design targets.
              </li>
              <li className="flex gap-2 items-start leading-relaxed">
                <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                Conclude interview consensus reports immediately to trigger secondary pipeline checks.
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200/60 text-sm font-sans animate-fade-in text-slate-800">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">Book Interview Round</h3>
              <button 
                id="close-booking-btn"
                onClick={() => setShowBooking(false)}
                className="text-slate-450 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBook} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Candidate *</label>
                <select
                  id="book-candidate-select"
                  value={targetCandId}
                  onChange={(e) => setTargetCandId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {candidates.map(cand => (
                    <option key={cand.id} value={cand.id}>{cand.name} ({cand.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Position Link *</label>
                <select
                  id="book-job-select"
                  value={targetJobId}
                  onChange={(e) => setTargetJobId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                  <input
                    id="book-date-input"
                    type="date"
                    required
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Time (UTC) *</label>
                  <input
                    id="book-time-input"
                    type="text"
                    required
                    placeholder="e.g. 15:30"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-605 mb-1">Setup Type</label>
                <select
                  id="book-type-select"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="video">Google Meet (Virtual video room)</option>
                  <option value="phone">Phone Screening Round</option>
                  <option value="in_person">In-Person Corporate Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-605 mb-1">Assigned HR Interviewer Representative</label>
                <input
                  id="book-interviewer-input"
                  type="text"
                  required
                  value={interviewerInput}
                  onChange={(e) => setInterviewerInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  id="cancel-booking-btn"
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-650 font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="submit-booking-btn"
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition"
                >
                  Confirm and Book Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
