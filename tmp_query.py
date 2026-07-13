import sqlite3, sys, json

DB = "C:/Users/NuttawatSi/.local/share/mimocode/mimocode.db"
conn = sqlite3.connect(DB)
c = conn.cursor()

cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

if cmd == "sessions":
    c.execute("SELECT id, directory, title, time_created FROM session WHERE directory LIKE '%ebidding%' ORDER BY time_created DESC LIMIT 20")
    for row in c.fetchall():
        print(row)

elif cmd == "schema":
    c.execute("PRAGMA table_info(message)")
    print("message columns:")
    for row in c.fetchall():
        print(f"  {row}")
    print()
    c.execute("PRAGMA table_info(part)")
    print("part columns:")
    for row in c.fetchall():
        print(f"  {row}")

elif cmd == "main_text":
    sid = sys.argv[2]
    c.execute("""SELECT m.id, json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.agent') as agent,
           json_extract(p.data, '$.type') as ptype,
           substr(json_extract(p.data, '$.text'), 1, 600) as txt
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
      AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created, p.time_created
    LIMIT 100""", (sid,))
    for row in c.fetchall():
        print(f"[{row[1]}|{row[2]}] {row[3]}: {row[4]}")
        print()

elif cmd == "raw_msg":
    mid = sys.argv[2]
    c.execute("SELECT data FROM message WHERE id = ?", (mid,))
    row = c.fetchone()
    if row:
        d = json.loads(row[0])
        print(json.dumps(d, indent=2)[:3000])

elif cmd == "search_any":
    q = sys.argv[2]
    c.execute("""SELECT m.session_id, json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.agent') as agent,
           substr(json_extract(p.data, '$.text'), 1, 400) as txt
    FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE json_extract(p.data, '$.type') = 'text'
      AND json_extract(p.data, '$.text') LIKE ?
    LIMIT 20""", (f"%{q}%",))
    for row in c.fetchall():
        print(f"[{row[0]}|{row[1]}|{row[2]}] {row[3]}")
        print()

elif cmd == "search_user_part":
    q = sys.argv[2]
    # Search in part text for user-typed content (within user messages)
    c.execute("""SELECT m.session_id, json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.agent') as agent,
           substr(json_extract(p.data, '$.text'), 1, 500) as txt
    FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE json_extract(p.data, '$.type') = 'text'
      AND json_extract(m.data, '$.role') = 'user'
      AND json_extract(p.data, '$.text') LIKE ?
    LIMIT 20""", (f"%{q}%",))
    for row in c.fetchall():
        print(f"[{row[0]}|{row[1]}|{row[2]}] {row[3]}")
        print()

conn.close()
