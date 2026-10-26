'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight, 
  Calculator, 
  Sparkles, 
  Wallet, 
  Coins,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  rawExpr: string;
  payer: string;
  splitAmong: string[];
  createdAt: string;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const CURRENCIES = [
  { symbol: 'NT$', name: 'TWD (台幣)' },
  { symbol: '$', name: 'USD (美元)' },
  { symbol: '¥', name: 'JPY (日圓)' },
  { symbol: '€', name: 'EUR (歐元)' },
];

export default function SplitExpertApp() {
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState('NT$');
  const [newMemberName, setNewMemberName] = useState('');
  
  // New Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [rawAmountExpr, setRawAmountExpr] = useState('');
  const [selectedPayer, setSelectedPayer] = useState('');
  const [selectedSplitAmong, setSelectedSplitAmong] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedMembers = localStorage.getItem('split_expert_members_v3');
      const savedExpenses = localStorage.getItem('split_expert_expenses_v3');
      const savedCurrency = localStorage.getItem('split_expert_currency_v3');
      if (savedMembers) setMembers(JSON.parse(savedMembers));
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedCurrency) setCurrency(savedCurrency);
    } catch (e) {
      console.error('Failed to load from localStorage', e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('split_expert_members_v3', JSON.stringify(members));
      localStorage.setItem('split_expert_expenses_v3', JSON.stringify(expenses));
      localStorage.setItem('split_expert_currency_v3', JSON.stringify(currency));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [members, expenses, currency]);

  // Ensure default payer / split list valid when members change
  useEffect(() => {
    if (members.length > 0) {
      if (!members.some(m => m.name === selectedPayer)) {
        setSelectedPayer(members[0].name);
      }
      if (selectedSplitAmong.length === 0) {
        setSelectedSplitAmong(members.map(m => m.name));
      }
    } else {
      setSelectedPayer('');
      setSelectedSplitAmong([]);
    }
  }, [members]);

  // Safe arithmetic expression evaluator
  const evaluateMath = (expr: string): number => {
    if (!expr) return 0;
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
    try {
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return typeof result === 'number' && !isNaN(result) ? Number(result.toFixed(2)) : 0;
    } catch {
      return 0;
    }
  };

  const previewAmount = evaluateMath(rawAmountExpr);

  // Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.some(m => m.name === trimmed)) {
      setErrorMsg('成員名稱已存在！');
      return;
    }
    const newM = { id: Date.now().toString(), name: trimmed };
    const updated = [...members, newM];
    setMembers(updated);
    setSelectedSplitAmong([...selectedSplitAmong, trimmed]);
    if (members.length === 0) setSelectedPayer(trimmed);
    setNewMemberName('');
    setErrorMsg('');
  };

  // Delete Member
  const handleDeleteMember = (name: string) => {
    const isUsed = expenses.some(exp => exp.payer === name || exp.splitAmong.includes(name));
    if (isUsed) {
      alert(`無法刪除「${name}」，因為該成員已有相關的支出或分攤紀錄！`);
      return;
    }
    setMembers(members.filter(m => m.name !== name));
    setSelectedSplitAmong(selectedSplitAmong.filter(n => n !== name));
  };

  // Add Expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (members.length === 0) {
      setErrorMsg('請先新增至少一位成員！');
      return;
    }
    if (!expenseTitle.trim()) {
      setErrorMsg('請輸入支出項目名稱');
      return;
    }
    const amount = evaluateMath(rawAmountExpr);
    if (amount <= 0) {
      setErrorMsg('請輸入有效的金額或計算式');
      return;
    }
    if (selectedSplitAmong.length === 0) {
      setErrorMsg('請至少選擇一位分攤人');
      return;
    }

    const newExp: Expense = {
      id: Date.now().toString(),
      title: expenseTitle.trim(),
      amount,
      rawExpr: rawAmountExpr,
      payer: selectedPayer,
      splitAmong: selectedSplitAmong,
      createdAt: new Date().toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    setExpenses([newExp, ...expenses]);
    setExpenseTitle('');
    setRawAmountExpr('');
    setErrorMsg('');
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  // Reset All Data
  const handleReset = () => {
    if (confirm('確定要清除所有成員與記帳資料並重新開始嗎？')) {
      setMembers([]);
      setExpenses([]);
      localStorage.removeItem('split_expert_members_v3');
      localStorage.removeItem('split_expert_expenses_v3');
      localStorage.removeItem('split_expert_currency_v3');
    }
  };

  // Core Debt Simplification Calculation
  const calculateDebts = (): { netBalances: Record<string, number>, settlements: Settlement[] } => {
    const netBalances: Record<string, number> = {};
    members.forEach(m => {
      netBalances[m.name] = 0;
    });

    expenses.forEach(exp => {
      const payer = exp.payer;
      const amount = Number(exp.amount) || 0;
      const splitAmong = exp.splitAmong || [];
      
      if (!payer || splitAmong.length === 0 || amount <= 0) return;

      if (netBalances[payer] !== undefined) {
        netBalances[payer] += amount;
      } else {
        netBalances[payer] = amount;
      }

      const share = amount / splitAmong.length;
      splitAmong.forEach(member => {
        if (netBalances[member] !== undefined) {
          netBalances[member] -= share;
        } else {
          netBalances[member] = -share;
        }
      });
    });

    Object.keys(netBalances).forEach(k => {
      netBalances[k] = Math.round(netBalances[k] * 100) / 100;
    });

    const creditors: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];

    Object.entries(netBalances).forEach(([name, balance]) => {
      if (balance > 0.01) {
        creditors.push({ name, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ name, amount: -balance });
      }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settleAmount = Math.min(debtor.amount, creditor.amount);
      if (settleAmount > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: Math.round(settleAmount * 100) / 100,
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return { netBalances, settlements };
  };

  const { netBalances, settlements } = calculateDebts();

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden">
      
      {/* Ambient background glowing gradient blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/10 via-cyan-500/10 to-teal-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Floating Glass Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#090d16]/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">分帳專家</span>
              <span className="ml-2.5 text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold">
                Quantum v3
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="選擇幣別"
              className="text-sm bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2 text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 backdrop-blur"
            >
              {CURRENCIES.map(c => (
                <option key={c.symbol} value={c.symbol} className="bg-slate-900 text-slate-200">{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all font-medium backdrop-blur"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">重置</span>
            </button>
          </div>
        </div>
      </header>

      {/* Fluid Tech Hero Section */}
      <section className="py-16 sm:py-24 px-6 sm:px-10 relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold mb-6 tracking-wide shadow-lg shadow-cyan-500/5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            無容器化流動設計 · 智能最小路徑運算
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
            智慧分帳，<span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">極速流暢無邊界</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            打破死板的卡片框線。流動式霓虹互動、實時貪婪拆帳與直覺四則運算，讓團體財務管理化繁為簡。
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>零時差動態解析</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
              <Calculator className="w-4 h-4 text-indigo-400" />
              <span>智慧算式引擎</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>未來科技美學</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Fluid Workspace (No rigid container boxes) */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 pb-24 space-y-16 relative z-10">
        
        {/* A. 頂部看板 (Fluid Glass Dashboard) */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition duration-500 pointer-events-none" />
          
          <div className="relative backdrop-blur-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">智慧轉帳建議與結算看板</h2>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold tracking-wider">
                ACTIVE
              </span>
            </div>

            {/* Settlements */}
            <div className="mb-10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">最佳轉帳路徑（最小化交易次數）</h3>
              {members.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-medium border border-dashed border-white/10 rounded-2xl">
                  請先在下方新增成員，即可自動計算最佳轉帳路徑。
                </div>
              ) : settlements.length === 0 ? (
                <div className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                  所有款項已結清，帳目完全平衡 ✨
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all backdrop-blur group/card">
                      <div className="flex items-center gap-3 font-medium text-slate-200">
                        <span className="px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold">{s.from}</span>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover/card:text-cyan-400 transition-colors" />
                        <span className="px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-bold">{s.to}</span>
                      </div>
                      <span className="text-lg font-black bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                        {currency} {s.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Personal Balance Overview */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">個人收支淨額總覽</h3>
              {members.length === 0 ? (
                <div className="text-xs text-slate-500">尚無成員資料</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {members.map(m => {
                    const net = netBalances[m.name] || 0;
                    const isPositive = net > 0.01;
                    const isNegative = net < -0.01;
                    return (
                      <div key={m.id} className="p-4.5 rounded-2xl bg-white/5 border border-white/10 text-center backdrop-blur hover:border-white/20 transition-all">
                        <div className="font-bold text-white mb-1 truncate text-base">{m.name}</div>
                        <div className={`text-base font-black ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}`}>
                          {isPositive ? `+${currency} ${net.toLocaleString()}` : `${currency} ${net.toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                          {isPositive ? '應收回' : isNegative ? '需支付' : '平衡'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* B & C. Member Management & Add Expense Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Member Management */}
          <div className="backdrop-blur-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">成員管理</h3>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold">{members.length} 位成員</span>
              </div>

              <form onSubmit={handleAddMember} className="flex gap-2.5 mb-6">
                <input
                  type="text"
                  placeholder="輸入成員姓名..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>
              {errorMsg && <p className="text-xs font-medium text-rose-400 mb-4">{errorMsg}</p>}

              <div className="flex flex-wrap gap-2.5">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">尚未新增成員，請在上方輸入。</p>
                ) : (
                  members.map(m => (
                    <div
                      key={m.id}
                      className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-200 hover:border-white/25 transition-all"
                    >
                      <span>{m.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(m.name)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                        title="刪除成員"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
              💡 提示：點擊成員右側刪除按鈕即可移除未參與記帳的成員。
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="backdrop-blur-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-xl lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <Receipt className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">新增支出記錄</h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">支出項目名稱</label>
                  <input
                    type="text"
                    placeholder="例如：晚餐、計程車、門票"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    金額 ({currency}) <span className="text-[11px] text-cyan-400 font-normal lowercase">支援算式 150*2+60</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="例如 150*2+60 或 800/4"
                      value={rawAmountExpr}
                      onChange={(e) => setRawAmountExpr(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-24 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-bold"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 rounded-xl">
                      = {previewAmount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">付款人 (誰先付錢)</label>
                  <select
                    value={selectedPayer}
                    onChange={(e) => setSelectedPayer(e.target.value)}
                    aria-label="選擇付款人"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {members.length === 0 ? (
                      <option value="">請先新增成員</option>
                    ) : (
                      members.map(m => (
                        <option key={m.id} value={m.name} className="bg-slate-900">{m.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">分攤人 (誰要一起出)</label>
                    <div className="space-x-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong(members.map(m => m.name))}
                        className="text-cyan-400 hover:underline"
                      >
                        全選
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong([])}
                        className="text-rose-400 hover:underline"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-wrap gap-2.5 min-h-[52px] max-h-32 overflow-y-auto">
                    {members.length === 0 ? (
                      <span className="text-xs text-slate-500 italic self-center">請先新增成員</span>
                    ) : (
                      members.map(m => {
                        const isChecked = selectedSplitAmong.includes(m.name);
                        return (
                          <label
                            key={m.id}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                              isChecked ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-md shadow-cyan-500/10' : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSplitAmong([...selectedSplitAmong, m.name]);
                                } else {
                                  setSelectedSplitAmong(selectedSplitAmong.filter(n => n !== m.name));
                                }
                              }}
                              className="rounded text-cyan-500 focus:ring-0 w-4 h-4 bg-transparent border-white/20"
                            />
                            {m.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:opacity-90 text-white px-8 py-3.5 rounded-2xl text-sm font-extrabold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                >
                  <Plus className="w-4.5 h-4.5" />
                  新增支出項目
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* D. Expense Details List */}
        <div className="backdrop-blur-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Receipt className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">支出明細列表</h2>
            </div>
            <span className="text-xs px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold">
              共 {expenses.length} 筆記錄
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="text-sm font-semibold text-slate-300">目前尚無任何支出記錄</p>
              <p className="text-xs text-slate-500 mt-1">請先新增成員並在上方建立您的第一筆分帳紀錄。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {expenses.map(exp => (
                <div key={exp.id} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col justify-between backdrop-blur group">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">{exp.title}</h4>
                      <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                        {currency} {exp.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 mb-4 font-medium">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold">
                        付款人: {exp.payer}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>分攤人數: {exp.splitAmong.length} 人</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-500">{exp.createdAt}</span>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/80 border border-white/5 rounded-xl px-3.5 py-2 mb-4 truncate font-medium">
                      分攤成員: {exp.splitAmong.join(', ')}
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除記錄
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#090d16] py-10 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-2">
          <p className="font-bold text-slate-400 text-sm">分帳專家 Split Expert · Quantum Edition</p>
          <p>© {2026} 內建最小化貪婪結算演算法與即時本地持久化。</p>
        </div>
      </footer>
    </div>
  );
}
