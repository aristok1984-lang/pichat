'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  full_name?: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  occupation?: string;
  location?: string;
  birthplace?: string;
  studied_at?: string;
  went_to?: string;
  x_account?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified: boolean;
  is_admin?: boolean;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  image_url: string;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  created_at: string;
}

function formatJoinDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function PublicProfilePage({ username }: { username: string }) {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'reels' | 'media'>('posts');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [fullscreenAvatar, setFullscreenAvatar] = useState(false);
  const [fullscreenBanner, setFullscreenBanner] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#EDE8E0';
    return () => { document.body.style.background = prev; };
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = supabaseRef.current;
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, full_name, bio, avatar_url, banner_url, occupation, location, birthplace, studied_at, went_to, x_account, followers_count, following_count, posts_count, is_verified, is_admin, created_at')
        .eq('username', username)
        .single();
      if (!profileData) { setLoading(false); return; }
      setProfile(profileData);
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, content, image_url, likes_count, comments_count, reposts_count, created_at')
        .eq('author_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (postsData) setPosts(postsData);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    function handleClick() { setOpenDropdown(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function toggleDropdown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenDropdown(prev => prev === id ? null : id);
  }

  function copyText(text: string) {
    try { navigator.clipboard.writeText(text); } catch { /* silent */ }
  }

  const displayName = profile?.display_name || profile?.full_name || profile?.username || username;
  const handle = profile?.username ? `@${profile.username}` : `@${username}`;
  const mediaPosts = posts.filter(p => p.image_url);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    .pp-wrap{font-family:'Inter',sans-serif;background:#EDE8E0;color:#fff;display:flex;justify-content:center;min-height:100vh;width:100%}
    .pp-card{width:100%;max-width:430px;background:#0E1621;min-height:100vh}
    .pp-hdr{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:.5px solid #2A3648;position:sticky;top:0;background:#0E1621;z-index:10}
    .pp-hdr-l{display:flex;align-items:center;gap:10px}
    .pp-hdr h1{font-size:15px;font-weight:700;letter-spacing:.01em;color:#fff;margin:0}
    .pp-cover{height:200px;overflow:hidden;background:#131D2B;cursor:pointer;background-size:cover;background-position:center}
    .pp-avrow{display:flex;align-items:flex-end;justify-content:space-between;padding:0 16px;margin-top:-44px;min-height:80px}
    .pp-av-wrap{position:relative;flex-shrink:0}
    .pp-av{width:80px;height:80px;border:.5px solid #2A97DF;border-radius:2px;overflow:hidden;background:#1A2535;cursor:pointer}
    .pp-av img{width:100%;height:100%;object-fit:cover;object-position:center top}
    .pp-id{padding:8px 16px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .pp-id-left .pp-name{font-size:18px;font-weight:600;line-height:1.2;color:#fff}
    .pp-id-left .pp-handle{color:#2A97DF;font-size:16px;font-weight:300;margin-top:2px}
    .pp-role-badges{display:flex;gap:8px;flex-shrink:0;margin-top:-10px;margin-right:-8px}
    .pp-rbadge-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;width:46px;flex-shrink:0}
    .pp-rbadge{width:32px;height:32px;flex-shrink:0;border-radius:2px;overflow:hidden;background:#1A2535;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
    .pp-rlbl{font-size:9px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;text-align:center;width:100%;white-space:nowrap}
    .pp-bio{margin:8px 0 0;background-color:#1A2535;background-image:linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%);background-repeat:no-repeat;background-size:100% .5px,100% .5px,.5px 100%,.5px 100%;background-position:top left,bottom left,top left,top right;border-radius:2px;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
    .pp-bloc{font-size:12px;font-weight:300;color:#EDE8E0;letter-spacing:.03em;border-bottom:.5px solid #2E4060;padding-bottom:8px;display:flex;align-items:center;gap:6px}
    .pp-btxt{font-size:13px;color:#B0C4D8;line-height:1.65;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis}
    .pp-btxt strong{color:#EDE8E0;font-weight:300}
    .pp-bfoot{display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:.5px solid #2E4060}
    .pp-bjoin{font-size:13px;color:#EDE8E0;display:flex;align-items:center;gap:4px}
    .pp-bmore{color:#2A97DF;cursor:pointer;font-size:12px;font-weight:300;letter-spacing:.03em;text-transform:uppercase}
    .pp-connector{height:8px;width:1px;margin:0 auto;background:linear-gradient(to bottom,rgba(42,54,72,0),rgba(90,120,160,.55) 50%,rgba(42,54,72,0))}
    .pp-stats{margin:0;background-color:#1A2535;background-image:linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%);background-repeat:no-repeat;background-size:100% .5px,100% .5px,.5px 100%,.5px 100%;background-position:top left,bottom left,top left,top right;border-radius:2px;box-shadow:0 4px 16px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);padding:16px 0 14px}
    .pp-sg{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center}
    .pp-st{padding:0 0 10px;cursor:pointer;position:relative}
    .pp-nw{position:relative;display:flex;justify-content:center}
    .pp-num{font-weight:800;font-size:22px;line-height:1;color:#fff}
    .pp-st:hover .pp-num{color:#2A97DF}
    .pp-lbl{color:#8AACC8;font-size:11px;font-weight:300;letter-spacing:.08em;text-transform:uppercase;margin-top:14px}
    .pp-ic{background-image:linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(90deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%),linear-gradient(180deg,transparent 0%,#2A3648 18%,#2A3648 82%,transparent 100%);background-repeat:no-repeat;background-size:100% .5px,100% .5px,.5px 100%,.5px 100%;background-position:top left,bottom left,top left,top right;border-radius:3px;margin:0;overflow:hidden}
    .pp-ich{background:#131D2B;border-bottom:.5px solid #2A3648;padding:10px 0 14px;text-align:center;background-image:linear-gradient(rgba(180,210,240,.25) .5px,transparent .5px),linear-gradient(90deg,rgba(180,210,240,.25) .5px,transparent .5px);background-size:20px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
    .pp-icb{background:#1A2535}
    .pp-igrid{display:grid;grid-template-columns:1fr 1fr}
    .pp-il{padding:4px 0}
    .pp-ir{display:flex;align-items:center;padding:10px 10px 10px 7px;gap:10px;font-size:13px}
    .pp-ico{color:#2A97DF;flex-shrink:0;display:flex}
    .pp-ilbl{color:#B0C4D8;width:80px;flex-shrink:0;font-size:12px;font-weight:300;letter-spacing:.03em;text-transform:uppercase}
    .pp-ival{color:#fff;flex:1}
    .pp-iempty{color:#5C6D82;font-style:italic;flex:1}
    .pp-ctitle{text-align:right;padding-right:7px;font-size:13px;font-weight:300;color:#B0C4D8;letter-spacing:.08em;text-transform:uppercase;padding-top:16px;padding-bottom:8px}
    .pp-crow{display:flex;align-items:center;padding:10px 7px;gap:7px;font-size:13px;justify-content:flex-end;padding-right:7px;position:relative}
    .pp-chev{display:inline-block;width:7px;height:7px;border-right:.5px solid #fff;border-bottom:.5px solid #fff;transform:rotate(45deg) translateY(-2px);flex-shrink:0;cursor:pointer}
    .pp-drop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(160deg,#1A2D42 0%,#0D1E2E 100%);border:.5px solid #2A3648;border-radius:2px;display:flex;flex-direction:column;z-index:100;box-shadow:0 8px 28px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);width:280px;overflow:hidden}
    .pp-dh{font-size:13px;font-weight:600;letter-spacing:.14em;color:#8AAEC8;text-align:center;padding:10px 12px 9px;border-bottom:.5px solid #2A3648;text-transform:uppercase;position:relative}
    .pp-dh .red{color:#E74C3C}
    .pp-dh .blue{color:#2A97DF}
    .pp-dc{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;gap:12px}
    .pp-dv{color:#EDE8E0;font-size:13px;font-weight:400;letter-spacing:.02em}
    .pp-dcp{cursor:pointer;opacity:.6;flex-shrink:0;display:flex}
    .pp-dcp:hover{opacity:1}
    .pp-ew{margin:8px 0 0;background:#1A2535;border:.5px solid #2A3648;border-radius:3px;overflow:hidden}
    .pp-eh{font-size:13px;font-weight:300;letter-spacing:.08em;text-transform:uppercase;color:#B0C4D8;text-align:center;padding:7px 0}
    .pp-etabs{display:grid;grid-template-columns:1fr 1fr 1fr 1fr}
    .pp-etab{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 0 8px;cursor:pointer;font-size:12px;font-weight:300;letter-spacing:.06em;text-transform:uppercase;color:#4A6A84;border-right:1px solid #2A3A4A;border-top:1px solid #2A3A4A;background:#111C29;transition:all .15s}
    .pp-etab:last-child{border-right:none}
    .pp-etab.active{color:#EDE8E0;background:#1A2535;border-top-color:transparent}
    .pp-tp{display:none}
    .pp-tp.active{display:block}
    .pp-te{text-align:center;padding:28px 0;font-size:11px;font-weight:300;color:#3C5268;letter-spacing:.08em}
    .pp-fso{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.95);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer}
    .pp-fsc{position:absolute;top:16px;right:16px;width:32px;height:32px;background:#1A2535;border:.5px solid #2A3648;border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#EDE8E0;font-size:16px;z-index:1000}
    .pp-hbtn{display:flex;align-items:center;gap:5px;background:#131D2B;border:.5px solid #2A3648;border-radius:2px;color:#B0C4D8;font-family:'Inter',sans-serif;font-size:13px;font-weight:300;letter-spacing:.04em;padding:7px 14px;cursor:pointer}
    .pp-hbtn-block{background:#131D2B;border:1px solid #C0392B;border-radius:2px;color:#B0C4D8;font-family:'Inter',sans-serif;font-size:13px;font-weight:300;letter-spacing:.04em;padding:7px 14px;cursor:pointer}
    .pp-bio-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(160deg,#1A2D42 0%,#0D1E2E 100%);border:.5px solid #2A3648;border-radius:2px;display:flex;flex-direction:column;z-index:100;box-shadow:0 8px 28px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);width:300px;max-width:88vw;overflow:hidden}
    .pp-loading{display:flex;align-items:center;justify-content:center;height:200px;color:#5C6D82;font-size:13px;font-weight:300;letter-spacing:.08em}
  `;

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div className="pp-wrap">
          <div className="pp-card">
            <div className="pp-hdr">
              <div className="pp-hdr-l">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{cursor:'pointer'}} onClick={() => router.back()}>
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                <h1>Profile</h1>
              </div>
            </div>
            <div className="pp-loading">Loading profile…</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="pp-wrap">
        <div className="pp-card">

          {/* HEADER */}
          <div className="pp-hdr">
            <div className="pp-hdr-l">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{cursor:'pointer'}} onClick={() => router.back()}>
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <h1>Profile</h1>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button className="pp-hbtn">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#B0C4D8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </button>
              <button className="pp-hbtn">Message</button>
              <button className="pp-hbtn-block">Block</button>
            </div>
          </div>

          {/* COVER */}
          <div
            className="pp-cover"
            onClick={() => setFullscreenBanner(true)}
            style={profile?.banner_url ? { backgroundImage: `url('${profile.banner_url}')` } : {}}
          />

          {/* AVATAR ROW */}
          <div className="pp-avrow">
            <div className="pp-av-wrap">
              <div className="pp-av" onClick={() => setFullscreenAvatar(true)}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={displayName} />
                  : <div style={{width:'100%',height:'100%',background:'#1A2535',display:'flex',alignItems:'center',justifyContent:'center',color:'#2A97DF',fontSize:'28px',fontWeight:700}}>{displayName.charAt(0).toUpperCase()}</div>
                }
              </div>
              {profile?.is_verified && (
                <span style={{position:'absolute',top:0,right:0,transform:'translate(50%,-50%)',width:22,height:22,zIndex:5,pointerEvents:'none',background:'#3992E9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              )}
            </div>
          </div>

          {/* IDENTITY + ROLE BADGES */}
          <div className="pp-id">
            <div className="pp-id-left">
              <div className="pp-name">{displayName}</div>
              <div className="pp-handle">{handle}</div>
            </div>
            {profile?.is_admin && (
              <div className="pp-role-badges">
                <div className="pp-rbadge-wrap">
                  <div className="pp-rbadge" style={{border:'1.2px solid #2A97DF'}}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2A97DF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <span className="pp-rlbl" style={{color:'#2A97DF'}}>Admin</span>
                </div>
              </div>
            )}
          </div>

          {/* BIO BLOCK */}
          <div className="pp-bio">
            <div className="pp-bloc">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#EDE8E0">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              LOCATION &nbsp;|&nbsp; <span style={{color:'#EDE8E0',fontWeight:400}}>{profile?.location || 'Athens, Greece'}</span>
            </div>
            <div className="pp-btxt">
              <strong>BIO:</strong> {profile?.bio || 'No bio yet.'}
            </div>
            <div className="pp-bfoot">
              <span className="pp-bjoin">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                Joined {profile?.created_at ? formatJoinDate(profile.created_at) : 'June 2026'}
              </span>
              <span className="pp-bmore" onClick={e => { e.stopPropagation(); setShowBioModal(true); }}>MORE</span>
            </div>
          </div>

          {/* Bio Modal */}
          {showBioModal && (
            <div className="pp-bio-modal">
              <div className="pp-dh">
                <span className="red">RED PILL</span> OR <span className="blue">BLUE PILL</span>?
                <span onClick={() => setShowBioModal(false)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:'#8AAEC8',fontSize:'14px',lineHeight:1}}>✕</span>
              </div>
              <div className="pp-dc" style={{flexDirection:'column',alignItems:'flex-start',padding:'14px 16px'}}>
                <span style={{fontSize:'13px',fontWeight:400,lineHeight:1.65,color:'#EDE8E0',textAlign:'left'}}>
                  {profile?.bio || 'No bio yet.'}
                </span>
              </div>
            </div>
          )}

          {/* CONNECTOR */}
          <div className="pp-connector" />

          {/* STATS */}
          <div className="pp-stats">
            <div className="pp-sg">
              {[
                { num: profile?.posts_count ?? posts.length, lbl: 'Posts' },
                { num: profile?.followers_count ?? 0, lbl: 'Followers' },
                { num: profile?.following_count ?? 0, lbl: 'Following' },
              ].map((item, i) => (
                <div key={i} className="pp-st">
                  <div className="pp-nw">
                    <span className="pp-num">{item.num}</span>
                    {i < 2 && <span style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',height:'24px',width:'.5px',background:'#2E4060'}} />}
                  </div>
                  <div className="pp-lbl">{item.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CONNECTOR */}
          <div className="pp-connector" />

          {/* INFO + CONTACTS */}
          <div className="pp-ic">
            <div className="pp-ich">
              <span style={{color:'#B0C4D8',fontSize:'13px',fontWeight:300,letterSpacing:'0.08em',textTransform:'uppercase'}}>PERSONAL INFORMATION</span>
              <svg viewBox="0 0 100 100" width="72" height="72" style={{filter:'drop-shadow(0px 6px 12px rgba(0,0,0,0.6))'}}>
                <rect x="10" y="10" width="80" height="80" rx="8" fill="#353638" stroke="#EDE8E0" strokeWidth="2"/>
                <circle cx="50" cy="38" r="14" fill="#FBFBFA"/>
                <path d="M20 80 Q20 58 50 58 Q80 58 80 80" fill="#FBFBFA"/>
              </svg>
            </div>
            <div className="pp-icb">
              <div className="pp-igrid">
                {/* LEFT: Personal Info */}
                <div className="pp-il">
                  <div className="pp-ir">
                    <span className="pp-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span>
                    <span className="pp-ilbl">Occ.:</span>
                    <span className={profile?.occupation ? 'pp-ival' : 'pp-iempty'}>{profile?.occupation || ''}</span>
                  </div>
                  <div className="pp-ir">
                    <span className="pp-ico"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#EDE8E0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></span>
                    <span className="pp-ilbl">P.O.B:</span>
                    <span className={profile?.birthplace ? 'pp-ival' : 'pp-iempty'}>{profile?.birthplace || ''}</span>
                  </div>
                  <div className="pp-ir">
                    <span className="pp-ico"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></span>
                    <span className="pp-ilbl">Studies:</span>
                    <span className={profile?.studied_at ? 'pp-ival' : 'pp-iempty'}>{profile?.studied_at || ''}</span>
                  </div>
                  <div className="pp-ir">
                    <span className="pp-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                    <span className="pp-ilbl">Went To:</span>
                    <span className={profile?.went_to ? 'pp-ival' : 'pp-iempty'}>{profile?.went_to || ''}</span>
                  </div>
                </div>

                {/* RIGHT: Contacts */}
                <div>
                  <div className="pp-ctitle">CONTACTS</div>

                  {/* X / LINK */}
                  <div className="pp-crow" onClick={e => e.stopPropagation()}>
                    <span className="pp-chev" onClick={e => toggleDropdown('drop-x', e)} />
                    <span onClick={e => toggleDropdown('drop-x', e)} style={{color:'#B0C4D8',fontSize:'12px',fontWeight:300,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px',cursor:'pointer'}}>LINK</span>
                    <span style={{flexShrink:0}}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584l-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
                    </span>
                    {openDropdown === 'drop-x' && (
                      <div className="pp-drop">
                        <div className="pp-dh">
                          <span className="red">RED PILL</span> OR <span className="blue">BLUE PILL</span>?
                          <span onClick={() => setOpenDropdown(null)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:'#8AAEC8',fontSize:'14px',lineHeight:1}}>✕</span>
                        </div>
                        <div className="pp-dc">
                          <span className="pp-dv">{profile?.x_account || '@aristotelkifti'}</span>
                          <span className="pp-dcp" onClick={() => copyText(profile?.x_account || '@aristotelkifti')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* EMAIL */}
                  <div className="pp-crow" onClick={e => e.stopPropagation()}>
                    <span className="pp-chev" onClick={e => toggleDropdown('drop-email', e)} />
                    <span onClick={e => toggleDropdown('drop-email', e)} style={{color:'#B0C4D8',fontSize:'12px',fontWeight:300,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px',cursor:'pointer'}}>EMAIL</span>
                    {openDropdown === 'drop-email' && (
                      <div className="pp-drop">
                        <div className="pp-dh">
                          <span className="red">RED PILL</span> OR <span className="blue">BLUE PILL</span>?
                          <span onClick={() => setOpenDropdown(null)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:'#8AAEC8',fontSize:'14px',lineHeight:1}}>✕</span>
                        </div>
                        <div className="pp-dc">
                          <span style={{color:'#EDE8E0',fontSize:'13px',fontStyle:'italic',lineHeight:1.5}}>I humbly ask for forgiveness, fellow traveler! This information I share only with my inner circle. God bless you.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PHONE */}
                  <div className="pp-crow" onClick={e => e.stopPropagation()}>
                    <span className="pp-chev" onClick={e => toggleDropdown('drop-phone', e)} />
                    <span onClick={e => toggleDropdown('drop-phone', e)} style={{color:'#B0C4D8',fontSize:'12px',fontWeight:300,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px',cursor:'pointer'}}>PHONE</span>
                    {openDropdown === 'drop-phone' && (
                      <div className="pp-drop">
                        <div className="pp-dh">
                          <span className="red">RED PILL</span> OR <span className="blue">BLUE PILL</span>?
                          <span onClick={() => setOpenDropdown(null)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:'#8AAEC8',fontSize:'14px',lineHeight:1}}>✕</span>
                        </div>
                        <div className="pp-dc">
                          <span style={{color:'#EDE8E0',fontSize:'13px',fontStyle:'italic',lineHeight:1.5}}>I sincerely apologize. But this is information I do not share. I hope I have not disappointed you. 😔</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ENGAGEMENT TABS */}
          <div className="pp-ew">
            <div className="pp-eh">ENGAGEMENT</div>
            <div className="pp-etabs">
              <div className={`pp-etab${activeTab === 'posts' ? ' active' : ''}`} onClick={() => setActiveTab('posts')}>
                <div style={{marginBottom:'4px',marginTop:'-2px'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h8"/>
                  </svg>
                </div>
                <span>Posts</span>
              </div>
              <div className={`pp-etab${activeTab === 'replies' ? ' active' : ''}`} onClick={() => setActiveTab('replies')}>
                <div style={{marginBottom:'4px',marginTop:'-2px'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <span>Replies</span>
              </div>
              <div className={`pp-etab${activeTab === 'reels' ? ' active' : ''}`} onClick={() => setActiveTab('reels')}>
                <div style={{marginBottom:'4px',marginTop:'-2px'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>
                  </svg>
                </div>
                <span>Reels</span>
              </div>
              <div className={`pp-etab${activeTab === 'media' ? ' active' : ''}`} onClick={() => setActiveTab('media')}>
                <div style={{marginBottom:'4px',marginTop:'-2px'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </div>
                <span>Media</span>
              </div>
            </div>
          </div>

          {/* TAB PANELS */}
          <div className={`pp-tp${activeTab === 'posts' ? ' active' : ''}`} style={{paddingBottom:60}}>
            {posts.length === 0
              ? <div className="pp-te">• No posts yet •</div>
              : posts.map(post => (
                <div key={post.id} style={{padding:'12px 16px',borderBottom:'.5px solid #2A3648'}}>
                  <div style={{fontSize:'13px',color:'#EDE8E0',lineHeight:1.6}}>{post.content}</div>
                  {post.image_url && <img src={post.image_url} alt="post" style={{width:'100%',borderRadius:'2px',marginTop:'8px'}} />}
                  <div style={{display:'flex',gap:'16px',marginTop:'8px',fontSize:'11px',color:'#5C6D82'}}>
                    <span>♥ {post.likes_count}</span>
                    <span>💬 {post.comments_count}</span>
                    <span>↺ {post.reposts_count}</span>
                  </div>
                </div>
              ))
            }
          </div>
          <div className={`pp-tp${activeTab === 'replies' ? ' active' : ''}`} style={{paddingBottom:60}}>
            <div className="pp-te">• No replies yet •</div>
          </div>
          <div className={`pp-tp${activeTab === 'reels' ? ' active' : ''}`} style={{paddingBottom:60}}>
            <div className="pp-te">• No reels yet •</div>
          </div>
          <div className={`pp-tp${activeTab === 'media' ? ' active' : ''}`} style={{paddingBottom:60}}>
            {mediaPosts.length === 0
              ? <div className="pp-te">• No media yet •</div>
              : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px',padding:'2px'}}>
                  {mediaPosts.map(post => (
                    <img key={post.id} src={post.image_url} alt="media" style={{width:'100%',aspectRatio:'1',objectFit:'cover'}} />
                  ))}
                </div>
            }
          </div>

        </div>
      </div>

      {/* FULLSCREEN OVERLAYS */}
      {fullscreenBanner && (
        <div className="pp-fso" onClick={() => setFullscreenBanner(false)}>
          <span className="pp-fsc" onClick={e => { e.stopPropagation(); setFullscreenBanner(false); }}>✕</span>
          {profile?.banner_url && <img src={profile.banner_url} alt="cover" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />}
        </div>
      )}
      {fullscreenAvatar && (
        <div className="pp-fso" onClick={() => setFullscreenAvatar(false)}>
          <span className="pp-fsc" onClick={e => { e.stopPropagation(); setFullscreenAvatar(false); }}>✕</span>
          {profile?.avatar_url && <img src={profile.avatar_url} alt={displayName} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />}
        </div>
      )}
    </>
  );
}
