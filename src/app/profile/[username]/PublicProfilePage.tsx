'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  is_founder?: boolean;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media'>('posts');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [fullscreenAvatar, setFullscreenAvatar] = useState(false);
  const [fullscreenBanner, setFullscreenBanner] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#EDE8E0';
    return () => { document.body.style.background = prev; };
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: profileData } = await supabase.from('user_profiles').select('*').eq('username', username).single();
      if (!profileData) return;
      setProfile(profileData);
      const { data: postsData } = await supabase.from('posts').select('*').eq('author_id', profileData.id).order('created_at', { ascending: false }).limit(20);
      if (postsData) setPosts(postsData);
    } catch { /* silent */ }
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

  const displayName = profile?.display_name || profile?.full_name || profile?.username || 'User';
  const handle = profile?.username ? `@${profile.username}` : `@${username}`;
  const mediaPosts = posts.filter(p => p.image_url);

  const css = `
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}
    :root{--bg:#0E1621;--bg2:#131D2B;--bgc:#1A2535;--bdr:#2A3648;--blue:#2A97DF;--green:#3CB371;--text:#FFFFFF;--t2:#A8B8CC;--t3:#5C6D82}
    .pp-wrap{font-family:'Inter',sans-serif;background:#EDE8E0;color:#fff;display:flex;justify-content:center;min-height:100vh;width:100%}
    .pp-card{width:100%;max-width:430px;background:var(--bg);min-height:100vh}
    .pp-hdr{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:.5px solid var(--bdr);position:sticky;top:0;background:var(--bg);z-index:10}
    .pp-hdr-l{display:flex;align-items:center;gap:10px}
    .pp-hdr h1{font-size:15px;font-weight:700;letter-spacing:.01em;color:#fff;margin:0}
    .pp-cover{height:200px;overflow:hidden;background:var(--bg2);cursor:pointer;background-size:cover;background-position:center}
    .pp-avrow{display:flex;align-items:flex-end;justify-content:space-between;padding:0 16px;margin-top:-32px;min-height:80px}
    .pp-av{width:80px;height:80px;border:.5px solid var(--blue);border-radius:2px;overflow:hidden;background:var(--bgc);flex-shrink:0;cursor:pointer}
    .pp-av img{width:100%;height:100%;object-fit:cover;object-position:center top}
    .pp-id{padding:4px 16px 0}
    .pp-name{font-size:18px;font-weight:600;line-height:1.2;color:#fff}
    .pp-handle{color:#2A97DF;font-size:16px;font-weight:300;margin-top:2px}
    .pp-badges{display:flex;align-items:center;gap:8px;margin-top:8px}
    .pp-bv{display:flex;align-items:center;gap:4px;background:#1B2531;border:.5px solid #6A7A8A;border-radius:2px;padding:3px 8px;font-size:10px;font-weight:300;color:#3CB371;width:80px;justify-content:center}
    .pp-bf{display:flex;align-items:center;background:#EDE8E0;border:.5px solid #000;border-radius:2px;color:#000;font-size:11px;font-weight:300;padding:3px 6px;align-self:stretch}
    .pp-bio{margin:8px 0 0;background:#1A2535;border:.5px solid #2A3648;border-radius:2px;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
    .pp-bloc{font-size:12px;font-weight:300;color:#EDE8E0;letter-spacing:.03em;border-bottom:.5px solid #2E4060;padding-bottom:8px;display:flex;align-items:center;gap:6px}
    .pp-btxt{font-size:13px;color:#B0C4D8;line-height:1.65}
    .pp-btxt strong{color:#EDE8E0;font-weight:300}
    .pp-bfoot{display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:.5px solid #2E4060}
    .pp-bjoin{font-size:13px;color:#EDE8E0;display:flex;align-items:center;gap:4px}
    .pp-bmore{color:#2A97DF;cursor:pointer;font-size:12px;font-weight:300;letter-spacing:.03em;text-transform:uppercase}
    .pp-stats{margin:0;background:#1A2535;border:.5px solid #2A3648;border-radius:2px;box-shadow:0 4px 16px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);padding:16px 0 14px}
    .pp-sg{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center}
    .pp-st{padding:0 0 10px;cursor:pointer;position:relative}
    .pp-nw{position:relative;display:flex;justify-content:center}
    .pp-num{font-weight:800;font-size:22px;line-height:1;color:#fff}
    .pp-lbl{color:#8AACC8;font-size:11px;font-weight:300;letter-spacing:.08em;text-transform:uppercase;margin-top:14px}
    .pp-ic{border:.5px solid #2A3648;border-radius:3px;margin:0;overflow:hidden}
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
    .pp-drop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(160deg,#1A2D42 0%,#0D1E2E 100%);border:.5px solid #2A97DF;border-radius:2px;display:flex;flex-direction:column;z-index:100;box-shadow:0 8px 28px rgba(0,0,0,.6),0 0 12px rgba(42,151,223,.15),inset 0 1px 0 rgba(255,255,255,.05);width:280px;overflow:hidden}
    .pp-dh{font-size:12px;font-weight:300;letter-spacing:.14em;color:#8AAEC8;text-align:center;padding:10px 12px 9px;border-bottom:.5px solid #2A3648;text-transform:uppercase;position:relative}
    .pp-dh .red{color:#E74C3C}
    .pp-dh .blue{color:#2A97DF}
    .pp-dc{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;gap:12px}
    .pp-dv{color:#EDE8E0;font-size:13px;font-weight:400;letter-spacing:.02em}
    .pp-dcp{cursor:pointer;opacity:.6;flex-shrink:0;display:flex}
    .pp-dcp:hover{opacity:1}
    .pp-ew{margin:0;background:#1A2535;border:.5px solid #2A3648;border-radius:3px;overflow:hidden}
    .pp-eh{font-size:13px;font-weight:300;letter-spacing:.08em;text-transform:uppercase;color:#B0C4D8;text-align:center;padding:7px 0}
    .pp-etabs{display:grid;grid-template-columns:1fr 1fr 1fr}
    .pp-etab{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 0 8px;cursor:pointer;font-size:12px;font-weight:300;letter-spacing:.06em;text-transform:uppercase;color:#4A6A84;border-right:1px solid #2A3A4A;border-top:1px solid #2A3A4A;background:#111C29;transition:all .15s;position:relative}
    .pp-etab:last-child{border-right:none}
    .pp-etab.active{color:#EDE8E0;background:#1A2535;border-top-color:transparent}
    .pp-etab.active::after{content:'';position:absolute;bottom:0;left:20%;right:20%;height:2px;background:#2A97DF;border-radius:2px 2px 0 0}
    .pp-tp{display:none}
    .pp-tp.active{display:block}
    .pp-te{text-align:center;padding:28px 0;font-size:11px;font-weight:300;color:#3C5268;letter-spacing:.08em}
    .pp-fso{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.95);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer}
    .pp-fsc{position:absolute;top:16px;right:16px;width:32px;height:32px;background:#1A2535;border:.5px solid #2A3648;border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#EDE8E0;font-size:16px;z-index:1000}
    .pp-btn{background:#131D2B;border:.5px solid #2A3648;border-radius:2px;color:#EDE8E0;font-family:Inter,sans-serif;font-size:13px;font-weight:300;letter-spacing:.04em;padding:7px 14px;cursor:pointer}
    .pp-btn2{background:#131D2B;border:.5px solid #2A3648;border-radius:2px;color:#8AAEC8;font-family:Inter,sans-serif;font-size:13px;font-weight:300;letter-spacing:.04em;padding:7px 14px;cursor:pointer}
    .pp-sbtn{display:flex;align-items:center;gap:5px;background:#131D2B;border:.5px solid #2A3648;border-radius:2px;padding:4px 10px;cursor:pointer;color:#B0C4D8;font-family:Inter,sans-serif;font-size:12px;font-weight:300;letter-spacing:.04em;flex-shrink:0}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

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
              <button className="pp-btn">Message</button>
              <button className="pp-btn2">Block</button>
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
            <div className="pp-av" onClick={() => setFullscreenAvatar(true)}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} />
                : <div style={{width:'100%',height:'100%',background:'#1A2535',display:'flex',alignItems:'center',justifyContent:'center',color:'#2A97DF',fontSize:'28px',fontWeight:700}}>{displayName.charAt(0).toUpperCase()}</div>
              }
            </div>
            <div style={{flex:1,paddingLeft:'12px',display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div className="pp-name">{displayName}</div>
                <button className="pp-sbtn">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#B0C4D8" strokeWidth="1.5">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share
                </button>
              </div>
              <div className="pp-handle">{handle}</div>
            </div>
          </div>

          {/* BADGES */}
          <div className="pp-id">
            <div className="pp-badges">
              <div className="pp-bv">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#2E7D32" d="M12 21.9q-.175 0-.325-.025t-.3-.075Q8 20.675 6 17.638T4 11.1V6.375q0-.625.363-1.125t.937-.725l6-2.25q.35-.125.7-.125t.7.125l6 2.25q.575.225.938.725T20 6.375V11.1q0 3.5-2 6.538T12.625 21.8q-.15.05-.3.075T12 21.9Z"/>
                  <path fill="#ffffff" d="m10.95 12.7l-1.4-1.4q-.3-.3-.7-.3t-.7.3q-.3.3-.3.713t.3.712l2.1 2.125q.3.3.7.3t.7-.3l4.25-4.25q.3-.3.3-.712t-.3-.713q-.3-.3-.713-.3t-.712.3Z"/>
                </svg>
                <span style={{color:'#EDE8E0'}}>Verified</span>
              </div>
              {profile?.is_founder && (
                <div className="pp-bf">Founder <span style={{color:'#0047FF',letterSpacing:0,fontSize:'8px'}}>•••</span></div>
              )}
            </div>
          </div>

          {/* BIO */}
          <div className="pp-bio">
            <div className="pp-bloc">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <path fill="#EDE8E0" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              LOCATION &nbsp;|&nbsp; <span style={{color:'#EDE8E0',fontWeight:400}}>{profile?.location || 'Athens, Greece'}</span>
            </div>
            <div className="pp-btxt">
              <strong>BIO:</strong> {profile?.bio || 'Founder of Human System Publishing and creator of PiChat. Building community-driven platforms that connect people, knowledge, and technology.'}
            </div>
            <div className="pp-bfoot">
              <span className="pp-bjoin">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                Joined {profile?.created_at ? formatJoinDate(profile.created_at) : 'June 2026'}
              </span>
              <span className="pp-bmore">MORE</span>
            </div>
          </div>

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

          {/* INFO + CONTACTS */}
          <div className="pp-ic">
            <div className="pp-ich">
              <span style={{color:'#B0C4D8',fontSize:'13px',fontWeight:300,letterSpacing:'0.08em',textTransform:'uppercase'}}>PERSONAL INFORMATION</span>
              <svg version="1.1" viewBox="0 0 1024 1024" width="72" height="72" style={{filter:'drop-shadow(0px 6px 12px rgba(0,0,0,0.6))'}} xmlns="http://www.w3.org/2000/svg">
                <path transform="translate(292,67)" d="m0 0h421l29 1 21 3 23 6 24 10 19 11 14 10 13 11 16 16 13 17 10 16 10 21 8 24 3 14 2 18v492l-2 20-5 21-8 22-9 19-10 16-10 13-12 14-8 8-11 9-12 9-15 9-16 8-15 6-17 5-16 3-9 1-22 1h-453l-25-2-23-5-20-7-23-11-14-9-12-9-12-11-15-15-10-13-11-17-8-16-6-14-7-24-3-16-2-26v-475l3-26 6-22 6-16 8-16 8-14 10-13 9-11 17-17 17-13 14-9 19-10 21-8 15-4 16-3 12-1z" fill="#353638" stroke="#EDE8E0" strokeWidth="12"/>
                <path transform="translate(453,162)" d="m0 0h45v508l-1 21-10-1-13-3-37-1-13-1v2l16 4 20 4 37 5 1 3v81l-1 34-21-1-12-3-21-8-18-10-12-8-14-10-16-13-14-12-29-29-9-11-12-15-9-13-12-19-12-21-8-16-9-19-10-26-10-30-8-31-6-29-5-32-4-38-2-36v-49l2-31 4-31 5-22 5-15 8-16 8-10 5-6 14-11 19-10 27-9 28-6 35-5 32-3z" fill="#C9C8C8"/>
                <path transform="translate(686,188)" d="m0 0 11 2 21 9 9 6 11 9 11 16 6 13 6 21 4 25 2 17 2 29v55l-3 49-6 45-7 36-7 27-9 29-7 19-10 24-14 29-10 17-14 22-14 18-14 17-7 7-7 8-4 5-8 7-14 13-6 5h-2v2l-16 12-12 8-13 8-10 6-16 8 18-8 19-11 16-11 18-14 14-12 12-12h2l2-4 15-15 9-11 12-15 14-20 15-26 14-27 14-34 8-22 9-31 8-36 6-36 3-24 3-38 1-20v-65h1l2 17 2 18v6l1 2v25l1 19v37l-3 9-2 28-3 24-6 17-3 16-1 17-5 15-3 7-3 14-3 8-18 44-8 16-8 15-4 7-4 6-4 7-6 7-3 9-8 11-11 12-6 8-14 16-6 7-3 5-7 5-15 15-11 7-6 6h-2v2l-12 9-5 5-6 3-9 6-27 12-11 4-13 4-16 2h-18l-11-2-17-5-7-4-28-10-7-6-11-7-10-7-12-9-5-4-5-5-6-7v-2h-2l-8-11-11-8-9-10-8-7-11-12-10-16-6-9-3-6-8-8-7-15-8-12-6-16-7-15-12-27-4-13-5-18-4-15-5-30-4-17-1-9-1-2-3-19-2-18 1-25 1-4-1-5 2-4-3-5 1-11-1-5v-7h1l1-14 2 1 2 36 4 38 5 32 6 29 8 31 12 36 10 24 10 22 12 22 13 21 11 16 10 13 11 13 9 10 25 25 11 9 16 13 16 11 16 10 16 8 18 7 10 2 21 2v-118l-16-1-32-5-21-5-4-2v-2l50 1 23 5v-84l1-227h2l2 6v5l-1 5h5l4-2h9l2 4 8-4 7-3 11-5 5-5 3-1v-2l8-3 5-3 6-2h4v-2l13-5 9-1v-2l10-1v-2l20-3 7-3 10-2 6 1 4-1h16l1-6-1-5-2-1-2-13-4-4-2-5v-14l-1-9-1-2 1-9 3-7v-4l-2-1-2-7 2-8-1-11 1-11h2l1-3-1-11 3-4 6-15 1-3 8-5z" fill="#121213"/>
                <path transform="translate(453,162)" d="m0 0h45v445l-2 3v-2l-11-1-8-4-4-8-1-6 1-12 1-3v-18l3-17v-20l1-34-1-27-2-16-4-20-5-11-7-8-6-8-5-6-10-4-8-5-7-3-9-4-15-4-5-3-15-3-6-2-17-2h-10l-5-1h-12l-13 1h-16l-7-2-5-5-3-12 2-5h2v-22l-2-6v-21l3-3-1-5-4-10-3-9 1-8 1-2v-11l1-6-2-4v-9l-1-11 1-5h-2v-2l-6 3-5 3-6 4-5 6h-2l-2 4-5 7h-2l-1 2 1-6 8-10 5-6 14-11 19-10 27-9 28-6 35-5 32-3z" fill="#FBFBFA"/>
                <path transform="translate(336,409)" d="m0 0h16l16 2 12 3 13 5 11 6 13 10 7 7 7 10 8 16 1 9-1 1-20 2-22 4h-32l-20-4-15-6-11-6-13-10-12-12-9-14-1-5 5-5 16-7 15-4z" fill="#141415"/>
                <path transform="translate(281,432)" d="m0 0 6 2 10 14 11 11 14 10 17 8 19 5 7 1h32l30-5 12-1 1-11 3 4 1 6-3 5 2 32-4 16-6 33-4 14-2 4-2 17 2 9 2 13v8l-1 1v5l5 3 12 6 16 4 4 3 10 2 7-1 2 5 2 9h6l4-6h1l1 12-1 10-14-4-4-2h-13l-29 4h-4l-5-7-6-3-1-3-1-14h-7l-5-5-2-5-8-1-5-5-7-8-5-4-4-5-5-3-3-5-8-3-3-6-4-4-1-2-8-3-5-5-10-9-3-6-9-7-2-5-3-1-4-8-9-8-7-16-6-8-4-7-4-10-1-13 2-13 3-3 8-4 8-3 1-5-5-6v-2h-2l-10-15z" fill="#FBFBFA"/>
                <path transform="translate(713,430)" d="m0 0 1 4-4 8-7 9-9 10-7 8 3 11 4 12v5l-2 6-1 7-3 8-5 13-3 4-3 7-4 6h-2l-1 3h-2l-2 6-7 9h-2l-1 4-5 4-8 8-5 4-9 3-4 2v2l-12 5-4 3-8-1-11-6-4-2h-4l-2-5-5-14-4-6v-3h-2l-1-7-3-7-2-14-2-6-2-10-1-15v-11l-2-7v-6l4-2 13 1 21 4 9 1h28l20-4 15-6 14-8 13-11 8-8 9-14z" fill="#343537"/>
              </svg>
            </div>
            <div className="pp-icb">
              <div className="pp-igrid">
                {/* LEFT: Personal Info */}
                <div className="pp-il">
                  {[
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>, lbl: 'Occ.:', val: profile?.occupation },
                    { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>, lbl: 'P.O.B:', val: profile?.birthplace },
                    { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>, lbl: 'Studies:', val: profile?.studied_at },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, lbl: 'Went To:', val: profile?.went_to },
                  ].map((row, i) => (
                    <div key={i} className="pp-ir">
                      <span className="pp-ico">{row.icon}</span>
                      <span className="pp-ilbl">{row.lbl}</span>
                      <span className={row.val ? 'pp-ival' : 'pp-iempty'}>{row.val || ''}</span>
                    </div>
                  ))}
                </div>

                {/* RIGHT: Contacts */}
                <div>
                  <div className="pp-ctitle">CONTACTS</div>

                  {/* X / LINK */}
                  <div className="pp-crow" onClick={e => e.stopPropagation()}>
                    <span className="pp-chev" onClick={e => toggleDropdown('drop-x', e)} />
                    <span style={{color:'#EDE8E0',fontSize:'12px',fontWeight:300,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px'}}>LINK</span>
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
                    <span style={{color:'#4A7FA5',fontSize:'12px',fontWeight:600,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px'}}>EMAIL</span>
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
                    <span style={{color:'#4A7FA5',fontSize:'12px',fontWeight:600,letterSpacing:'0.03em',whiteSpace:'nowrap',marginLeft:'5px'}}>PHONE</span>
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
              {(['posts','replies','media'] as const).map(tab => (
                <div key={tab} className={`pp-etab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
                  <div style={{marginBottom:'4px',marginTop:'-2px'}}>
                    {tab === 'posts' && <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#EDE8E0" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                    {tab === 'replies' && <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#EDE8E0" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                    {tab === 'media' && <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#EDE8E0" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                  </div>
                  <span>{tab === 'posts' ? 'Posts' : tab === 'replies' ? 'Replies' : 'Reels'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TAB PANELS */}
          <div className={`pp-tp${activeTab === 'posts' ? ' active' : ''}`}>
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
          <div className={`pp-tp${activeTab === 'replies' ? ' active' : ''}`}>
            <div className="pp-te">• No replies yet •</div>
          </div>
          <div className={`pp-tp${activeTab === 'media' ? ' active' : ''}`}>
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
