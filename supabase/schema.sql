-- AStock Quant Schema
-- Run this in Supabase SQL Editor

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stocks
CREATE TABLE IF NOT EXISTS stocks (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  market VARCHAR(10) NOT NULL,
  sector VARCHAR(50),
  list_date DATE,
  is_active BOOLEAN DEFAULT true
);

-- Watchlist groups
CREATE TABLE IF NOT EXISTS watchlist_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_code VARCHAR(10) NOT NULL REFERENCES stocks(code),
  group_id UUID REFERENCES watchlist_groups(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_code)
);

-- Daily quotes
CREATE TABLE IF NOT EXISTS daily_quotes (
  id BIGSERIAL PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL REFERENCES stocks(code),
  trade_date DATE NOT NULL,
  open DECIMAL(10,3),
  high DECIMAL(10,3),
  low DECIMAL(10,3),
  close DECIMAL(10,3),
  volume BIGINT,
  amount DECIMAL(15,2),
  turnover DECIMAL(10,4),
  UNIQUE(stock_code, trade_date)
);

-- Realtime quotes
CREATE TABLE IF NOT EXISTS realtime_quotes (
  stock_code VARCHAR(10) PRIMARY KEY REFERENCES stocks(code),
  price DECIMAL(10,3),
  change DECIMAL(10,3),
  change_percent DECIMAL(8,4),
  volume BIGINT,
  amount DECIMAL(15,2),
  high DECIMAL(10,3),
  low DECIMAL(10,3),
  open DECIMAL(10,3),
  pre_close DECIMAL(10,3),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial metrics
CREATE TABLE IF NOT EXISTS financial_metrics (
  id BIGSERIAL PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL REFERENCES stocks(code),
  report_date DATE NOT NULL,
  report_type VARCHAR(10),
  revenue DECIMAL(20,4),
  net_profit DECIMAL(20,4),
  eps DECIMAL(10,4),
  roe DECIMAL(10,4),
  pe_ttm DECIMAL(10,4),
  pb DECIMAL(10,4),
  gross_margin DECIMAL(10,4),
  net_margin DECIMAL(10,4),
  UNIQUE(stock_code, report_date)
);

-- User strategies
CREATE TABLE IF NOT EXISTS user_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backtest results
CREATE TABLE IF NOT EXISTS backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES user_strategies(id) ON DELETE SET NULL,
  stock_code VARCHAR(10) NOT NULL REFERENCES stocks(code),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_return DECIMAL(10,4),
  annual_return DECIMAL(10,4),
  sharpe_ratio DECIMAL(10,4),
  max_drawdown DECIMAL(10,4),
  win_rate DECIMAL(10,4),
  trade_count INTEGER,
  result_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_quotes_date ON daily_quotes(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_quotes_code_date ON daily_quotes(stock_code, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_code ON realtime_quotes(stock_code);
CREATE INDEX IF NOT EXISTS idx_financial_code_date ON financial_metrics(stock_code, report_date DESC);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own groups" ON watchlist_groups FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own watchlist" ON watchlist_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own strategies" ON user_strategies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own backtests" ON backtest_results FOR ALL USING (auth.uid() = user_id);

-- Public read for market data
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stocks" ON stocks FOR SELECT USING (true);
CREATE POLICY "Public read daily" ON daily_quotes FOR SELECT USING (true);
CREATE POLICY "Public read realtime" ON realtime_quotes FOR SELECT USING (true);
CREATE POLICY "Public read financial" ON financial_metrics FOR SELECT USING (true);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
