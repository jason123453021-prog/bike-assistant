# FTP 建議模型依據

本機 FTP 建議僅分析使用者已保存於裝置的功率紀錄，且**絕不自動覆寫**設定值。模型採用最近 90 天、至少兩次具足夠功率資料的有效騎乘，從持續 20 分鐘以上的最佳平均功率取 95% 作為建議，並以目前 FTP 的 ±15% 作為單次建議變動上限；資料不足或努力段不足時不提出建議。

此保守設計源於 McGrath 等人的研究：在高度訓練受試者中，以 20 分鐘最大努力平均功率扣除 5% 的計算 FTP，重複測試的協議具可接受一致性，但測試仍要求控制準備狀態及最大努力，不能將一般騎乘自動等同正式 FTP 測試。[1]

Garmin 的公開說明同樣指出，FTP 是約可維持一小時的強度；提高估計可靠性需有功率計、心率與持續跨越閾值的努力資料。因此本 App 顯示資料量與信心水準，並要求使用者確認才寫入設定。[2]

## References

[1] [McGrath et al., *Is the FTP Test a Reliable, Reproducible and Functional Assessment Tool in Highly-Trained Athletes?*](https://pmc.ncbi.nlm.nih.gov/articles/PMC6886609/)

[2] [Garmin, Functional Threshold Power (FTP)](https://www.garmin.com/en-US/garmin-technology/cycling-science/physiological-measurements/ftp/)
