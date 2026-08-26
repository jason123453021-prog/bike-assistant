# 免費補水點與拍照景點圖層：資料語意與 Local-first 政策

本功能以使用者目前地圖範圍的公開 OpenStreetMap 資料為候選來源；取得後會緩存在裝置本機。它不建立帳號、不上傳位置歷史，也不把 POI 快取同步至雲端。

| 圖層 | 接受的主要 OpenStreetMap 語意 | 使用者可見承諾 | 不納入為已確認補水點的類別 |
| --- | --- | --- | --- |
| 免費補水點 | `amenity=drinking_water`、`drinking_water=yes`、`drinking_water:refill=yes` | 來源已標記為人類可飲用水或免費補水網絡；仍須在現場確認可用性、開放時間與容器適用性。 | 未帶明確飲水標籤的警察局、車站、遊客中心、單車店與一般商店。 |
| 拍照／景點 | `tourism=viewpoint`、`natural=peak`、`historic=memorial` 或具景觀意義的 `tourism=attraction` | 顯示公共地圖中標記的觀景、山頂或地標候選點；不保證可進入、可停車或適合拍照。 | 缺乏景觀或地標語意的一般設施。 |

> `amenity=drinking_water` 的正式語意是「供人類飲用的可飲用水來源」；`tourism=viewpoint` 指值得造訪並通常具有良好景觀的地點。[1] [2]

資料更新採取手動／地圖範圍變動觸發，且以有限範圍、去重、短期本機快取與 zoom-based 聚合減少網路與渲染負擔。當資料暫時不可用時，會保留現有本機快取或顯示空狀態，不使用虛構點位。

## References

[1]: https://wiki.openstreetmap.org/wiki/Tag:amenity%3Ddrinking_water "OpenStreetMap Wiki — Tag: amenity=drinking_water"
[2]: https://wiki.openstreetmap.org/wiki/Tag:tourism%3Dviewpoint "OpenStreetMap Wiki — Tag: tourism=viewpoint"
