# 1. 徹底刪除本機舊的鎖定檔與套件快取
Remove-Item -Recurse -Force package-lock.json, node_modules -ErrorAction SilentlyContinue

# 2. 重新安裝並產出全新、完全同步的 package-lock.json
npm install

# 3. 提交全新的 lock 檔並推送到 GitHub
git add package.json package-lock.json ; git commit -m "fix: regenerate package-lock.json" ; git push origin main

# 4. 重新啟動 EAS 雲端打包
eas build -p android --profile preview