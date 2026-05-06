# テストアカウント一覧

アプリURL: http://localhost:3010

## 管理者系ロール

| ロール | 役職タイトル | 名前 | メールアドレス | パスワード | 権限 |
|--------|-------------|------|----------------|------------|------|
| S（社長） | president | 社長 テスト | president@daishin.test | Test1234! | 全閲覧・全承認・最終承認 |
| A（専務） | executive | 専務 テスト | director@daishin.test | Test1234! | 全閲覧・承認（4枠承認の専務枠） |
| A（常務） | managing | 常務 テスト | jomu@daishin.test | Test1234! | 全閲覧・承認（4枠承認の常務枠） |
| A_special（総務部長） | — | 総務部長 テスト | general-affairs@daishin.test | Test1234! | 全閲覧のみ・給与管理 |
| B（施工部長） | construction_manager | 施工部長 テスト | construction-manager@daishin.test | Test1234! | 日報閲覧・チェック（4枠承認の施工部長枠） |

## 現場系ロール

| ロール | 名前 | メールアドレス | パスワード | 権限 |
|--------|------|----------------|------------|------|
| G（現場監督） | 横山 憲章 | supervisor@daishin.test | Test1234! | 現場日報入力・照合確認 |
| general（作業員） | 田中 太郎 | worker@daishin.test | Test1234! | 自分の日報入力・有給申請 |

## 各ロールでアクセス可能なメニュー

### S / A（社長・専務・常務）
- ダッシュボード（承認待ち一覧・日次一括スライド承認）
- 日報承認・差し戻し
- 有給申請承認
- 照合チェック
- 勤怠集計・給与計算
- マスター管理
- 社員管理

### A_special（総務部長）
- ダッシュボード（閲覧のみ）
- 勤怠集計・給与計算
- 社員管理

### B（施工部長）
- ダッシュボード（閲覧のみ）
- 日報チェック（施工部長枠の押印）

### G（現場監督）
- 現場日報入力・履歴
- 日報確認済み操作（supervisor_confirmed）
- 有給申請

### general（作業員）
- 日報入力・提出・履歴
- 有給申請

## 承認フロー

### Step1〜2: 事前確認（従来通り）
```
作業員(general) → 提出(submitted)
      ↓
現場監督(G) → 確認済み(supervisor_confirmed)
```

### Step3〜6: 4枠承認（順序固定）

```
施工部長(construction_manager)
      ↓
常務(managing)
      ↓
専務(executive)
      ↓
社長(president) → 4人全員揃ったら status=approved
```

- 順序を飛ばした承認は422で拒否される
- 自分の押印は「自分より後の slot がまだ未押印」のときのみ取消可
- 差し戻しは引き続き `rejected` ステータス
