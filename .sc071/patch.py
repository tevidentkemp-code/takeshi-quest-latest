from pathlib import Path
import hashlib, json

def patch_file(path, expected, edit):
    p=Path(path); raw=p.read_bytes()
    blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    assert blob==expected,(path,blob,expected)
    text=raw.decode(); changed=edit(text); assert changed!=text
    p.write_text(changed)

def once(text, old, new, count=1):
    assert text.count(old)==count,(old[:90],text.count(old),count)
    return text.replace(old,new)

def menu(s):
    s=once(s,'function openModalShell(title, sub){','function openModalShell(title, sub, onBack){')
    old='<button class="sq-menu106-back" type="button" aria-label="Back">‹</button>'
    new='\'+(typeof onBack===\'function\'?\'<button class="sq-menu106-back" type="button" aria-label="Back">‹</button>\':\'<span aria-hidden="true"></span>\')+\''
    s=once(s,old,new)
    s=once(s,"    modal.querySelector('.sq-menu106-back').onclick=close;", "    // SC-071: only a genuine parent gets Back; Close never reopens it.\n    var back=modal.querySelector('.sq-menu106-back');\n    if(back) back.onclick=function(){close();onBack();};")
    for title,sub in [('Add Guest Player','Joins as the final thrower'),('Add Player','Joins as the final thrower'),('Remove Player','Current game only'),('Match Display','Only this match; saved player profiles stay unchanged')]:
        s=once(s,f"openModalShell('{title}','{sub}')",f"openModalShell('{title}','{sub}',prev)")
    s=once(s,"    m.modal.querySelector('.sq-menu106-back').onclick=function(){m.close();if(prev)prev();};\n",'',4)
    s=once(s,"m.close();var edit=openModalShell('Match Initials',player.name||'Player');\n        edit.modal.querySelector('.sq-menu106-back').onclick=function(){edit.close();openMatchDisplayMenu(prev);};", "m.close();var edit=openModalShell('Match Initials',player.name||'Player',function(){openMatchDisplayMenu(prev);});")
    s=once(s,"openModalShell('Player Stats','Choose a stats view')", "openModalShell('Player Stats','Choose a stats view',document.body.dataset.page==='game'?window.__sqOpenGameMenu106:null)")
    s=once(s,"    var v3on=false; try{ v3on = localStorage.getItem('sq_livev3_test')==='1'; }catch(_){ }\n",'')
    start=s.index("    addRow(m.body,{ico:'🧪',label:'New Layout (Beta): '")
    end=s.index('    var __addGate=',start)
    assert "localStorage.setItem('sq_livev3_test'" in s[start:end]
    s=s[:start]+"    // SC-071 hides only the beta menu entry; experimental code/settings stay intact.\n"+s[end:]
    icons={
      'stats':'<path d="M5 19V11M12 19V5M19 19V8"/>',
      'tv':'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
      'add':'<path d="M12 5v14M5 12h14"/>',
      'edit':'<path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z"/>',
      'remove':'<path d="M5 12h14"/>',
      'order':'<path d="M8 20V4m-4 4 4-4 4 4M16 4v16m-4-4 4 4 4-4"/>',
      'restart':'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
      'stop':'<rect x="5" y="5" width="14" height="14" rx="1"/>',
      'finish':'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
      'race':'<path d="M3 17l6-6 4 3 8-10M15 4h6v6"/>',
      'table':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 4v16"/>',
      'trophy':'<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v7m-4 1h8"/>',
      'warning':'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
      'next':'<path d="m9 5 7 7-7 7"/>'
    }
    icon_code="  // SC-071: fixed, decorative line icons. Labels remain escaped below.\n  var MENU_ICONS="+json.dumps(icons,ensure_ascii=False,indent=4)+";\n  function menuIcon(name){\n    return '<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\">'+(MENU_ICONS[name]||MENU_ICONS.next)+'</svg>';\n  }\n"
    s=once(s,'  function addRow(body,opt){',icon_code+'  function addRow(body,opt){')
    s=once(s,"<span class=\"sq-menu106-ico\">'+esc(opt.ico||'›')+'", "<span class=\"sq-menu106-ico\" aria-hidden=\"true\">'+menuIcon(opt.ico)+'")
    mapping={'📊':'stats','▣':'tv','＋':'add','✎':'edit','−':'remove','↕':'order','↻':'restart','⏹':'stop','🏁':'finish','📈':'race','▦':'table','🏆':'trophy','⚠':'warning'}
    for glyph,key in mapping.items():
        assert "ico:'"+glyph+"'" in s,glyph
        s=s.replace("ico:'"+glyph+"'", "ico:'"+key+"'")
    return s

def css(s):
    s=once(s,'grid-template-columns:38px 1fr 38px','grid-template-columns:44px minmax(0,1fr) 44px')
    s=once(s,'.sq-menu106-x,.sq-menu106-back{width:36px;height:36px;', '.sq-menu106-x,.sq-menu106-back{width:44px;height:44px;')
    s=once(s,'.sq-menu106-close{min-width:130px;min-height:42px;', '.sq-menu106-close{min-width:130px;min-height:44px;')
    s=once(s,'.sq-menu106-head>*{position:relative;z-index:1;}', '.sq-menu106-head>*{position:relative;z-index:1;}\n/* SC-071: fixed icon geometry and touch-safe navigation in every shared mode. */\n.sq-menu106-head>div{min-width:0;overflow-wrap:anywhere;}\n.sq-menu106-ico svg{display:block;width:20px;height:20px;}')
    return s

patch_file('src/legacy/scripts/inline-030.js','465cadbcfb447c04cadf7e16ef96509d7d73c887',menu)
patch_file('src/legacy/styles/inline-029.css','9db773873aa8da2d137d45cc07619b51cca1c2b3',css)

# Candidate only. SC-077 remains a separate, unreleased 0.14.3 candidate.
p=Path('assets/release-metadata.json'); raw=p.read_text(); data=json.loads(raw)
assert data['currentVersion']=='0.14.2' and data['currentReleaseId']=='SC-072-LINEUP-CARDS'
assert not any(r.get('version')=='0.14.4' for r in data['releases'])
raw=once(raw,'"currentVersion": "0.14.2"','"currentVersion": "0.14.4"')
raw=once(raw,'"currentReleaseId": "SC-072-LINEUP-CARDS"','"currentReleaseId": "SC-071-MENU-CLEANUP"')
release={'version':'0.14.4','releaseId':'SC-071-MENU-CLEANUP','date':'2026-10-08','title':'Consistent in-game menu controls','changes':['Used minimal line icons and genuine Back navigation throughout the shared game menus.','Removed the New Layout Beta menu entry without resetting its existing setting or removing the experiment.','Preserved mode-specific actions, player management, scoring and Training navigation.']}
entry='\n'.join('    '+line for line in json.dumps(release,ensure_ascii=False,indent=2).splitlines())
raw=once(raw,'"releases": [\n','"releases": [\n'+entry+',\n');p.write_text(raw)
p=Path('src/legacy/quarantine/core-pre-modals.js');p.write_text(once(p.read_text(),"const RUNNING_VERSION = '0.14.2';","const RUNNING_VERSION = '0.14.4';"))
