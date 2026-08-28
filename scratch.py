with open('/Users/admin/Downloads/My-Space/frontend/src/pages/Staff.jsx', 'r') as f:
    content = f.read()

search = '<div className="col-span-2"><Label>Password</Label><Input type="text" placeholder="Set staff password" className="rounded-xl mt-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>'
repl = '<div className="col-span-2"><Label>Password</Label><Input type="text" placeholder="Set staff password (defaults to password123)" className="rounded-xl mt-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><p className="text-xs text-slate-500 mt-1">If left blank, the staff can log in using <b>password123</b></p></div>'

content = content.replace(search, repl)

with open('/Users/admin/Downloads/My-Space/frontend/src/pages/Staff.jsx', 'w') as f:
    f.write(content)
