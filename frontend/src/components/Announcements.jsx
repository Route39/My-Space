import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Megaphone, Plus, X, Image as ImageIcon, Link as LinkIcon, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function timeAgo(dateString) {
  const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AnnouncementsSection({ announcements = [], isAdmin, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const deleteAnn = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      toast.success("Deleted");
      reload();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900">
          <Megaphone className="w-5 h-5 text-amber-500" fill="currentColor" />
          <h2 className="font-heading font-bold text-xl">Announcements</h2>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-2 h-auto text-sm gap-1.5 shadow-md">
            <Plus className="w-4 h-4" /> Post
          </Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No recent announcements.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative group overflow-hidden flex flex-col">
              {isAdmin && (
                <button onClick={() => deleteAnn(ann.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  {ann.type}
                </span>
                <span className="text-xs text-slate-400">{timeAgo(ann.created_at)}</span>
              </div>
              {ann.expires_at && (
                <div className="mb-2 text-[11px] font-medium text-emerald-600/80 bg-emerald-50 w-fit px-2 py-0.5 rounded-md">
                  Expires: {new Date(ann.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              )}
              <h3 className="font-heading font-semibold text-slate-900 text-lg leading-tight mb-2">{ann.title}</h3>
              <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap flex-1">{ann.message}</p>

              {ann.image_data && (
                <div 
                  className="mt-3 rounded-xl overflow-hidden cursor-pointer border border-slate-100 bg-slate-50 relative aspect-video"
                  onClick={() => setLightbox(ann.image_data)}
                >
                  <img src={ann.image_data} alt="Announcement" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              
              {ann.link_url && (
                <a href={ann.link_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 w-fit">
                  <LinkIcon className="w-4 h-4" /> Open Link
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <PostAnnouncementModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); reload(); }} />}

      {lightbox && createPortal(
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-all">
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  );
}

function PostAnnouncementModal({ onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({ title: "", type: "General Update", message: "", link_url: "", image_data: "", duration_days: 2, expiry_date: "", expiry_time: "" });
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Image too large (max 10MB)");
    const reader = new FileReader();
    reader.onload = (ev) => setData({ ...data, image_data: ev.target.result });
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/announcements", data);
      toast.success("Announcement posted!");
      onSuccess();
    } catch (err) {
      toast.error("Failed to post");
    }
    setBusy(false);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-heading text-xl font-bold text-slate-900">Post Announcement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 pt-0 custom-scrollbar">
          <form id="ann-form" onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
              <input required type="text" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} 
                className="w-full bg-white border border-emerald-500/50 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <select value={data.type} onChange={(e) => setData({ ...data, type: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm appearance-none">
                <option>General Update</option>
                <option>Important</option>
                <option>Event</option>
                <option>Policy Change</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
              <textarea required rows={4} value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Exact Expiry Date (Optional)</label>
                <input type="date" value={data.expiry_date} onChange={(e) => setData({ ...data, expiry_date: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Exact Expiry Time (Optional)</label>
                <input type="time" value={data.expiry_time} onChange={(e) => setData({ ...data, expiry_time: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Or Expiry Duration (Default 2 Days)</label>
              <select value={data.duration_days} onChange={(e) => setData({ ...data, duration_days: Number(e.target.value) })}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm appearance-none">
                <option value={1}>1 Day</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
                <option value={7}>1 Week</option>
                <option value={14}>2 Weeks</option>
                <option value={30}>1 Month</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Link URL (Optional)</label>
              <input type="url" placeholder="https://" value={data.link_url} onChange={(e) => setData({ ...data, link_url: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Image (Optional)</label>
              <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleImage} />
              {data.image_data ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video group">
                  <img src={data.image_data} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" onClick={() => { setData({ ...data, image_data: "" }); fileRef.current.value = ""; }} className="bg-white/20 hover:bg-red-500 text-white rounded-full p-2 backdrop-blur-sm transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-fit flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
                  <ImageIcon className="w-4 h-4" /> Upload Image
                </button>
              )}
            </div>
          </form>
        </div>
        
        <div className="p-6 pt-4 border-t border-slate-100 flex justify-end sticky bottom-0 bg-white">
          <Button type="submit" form="ann-form" disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-6 py-3 h-auto text-sm font-medium w-full sm:w-auto shadow-lg shadow-emerald-500/20">
            {busy ? "Posting..." : "Post Announcement"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

