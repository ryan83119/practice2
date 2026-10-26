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
      const savedMembers = localStorage.getItem('split_expert_members_v4');
      const savedExpenses = localStorage.getItem('split_expert_expenses_v4');
      const savedCurrency = localStorage.getItem('split_expert_currency_v4');
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
      localStorage.setItem('split_expert_members_v4', JSON.stringify(members));
      localStorage.setItem('split_expert_expenses_v4', JSON.stringify(expenses));
      localStorage.setItem('split_expert_currency_v4', JSON.stringify(currency));
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
      localStorage.removeItem('split_expert_members_v4');
      localStorage.removeItem('split_expert_expenses_v4');
      localStorage.removeItem('split_expert_currency_v4');
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
    <div className="min-h-screen bg-[#f4f7fa] text-[#1e293b] font-sans antialiased selection:bg-indigo-500/20 selection:text-indigo-900 relative overflow-hidden">
      
      {/* Ambient background glowing gradient blobs (Light mode soft vibe) */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-300/20 via-sky-300/20 to-teal-200/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-[500px] h-[500px] bg-gradient-to-br from-purple-300/20 via-pink-200/25 to-indigo-200/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Floating Glass Header (Light Mode) */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 bg-clip-text text-transparent">分帳專家</span>
              <span className="ml-2.5 text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold">
                Vibrant Light
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="選擇幣別"
              className="text-sm bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-2xs"
            >
              {CURRENCIES.map(c => (
                <option key={c.symbol} value={c.symbol}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl transition-all font-semibold shadow-2xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">重置</span>
            </button>
          </div>
        </div>
      </header>

      {/* Fluid Light Hero Section */}
      <section className="py-16 sm:py-20 px-6 sm:px-10 relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/85 text-indigo-700 text-xs font-bold mb-6 tracking-wide shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            無容器化流動設計 · 智能最小路徑運算
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-tight">
            智慧分帳，<span className="bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 bg-clip-text text-transparent">極速流暢無邊界</span>
          </h1>
          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            清新亮麗的現代設計。實時貪婪拆帳與直覺四則運算，讓團體財務管理化繁為簡。
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-700 font-semibold">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>零時差動態解析</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <Calculator className="w-4 h-4 text-sky-600" />
              <span>智慧算式引擎</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <Zap className="w-4 h-4 text-teal-600" />
              <span>亮麗科技美學</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Fluid Workspace (Light Mode Glassmorphism) */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 pb-24 space-y-16 relative z-10">
        
        {/* A. 頂部看板 (Light Glass Dashboard) */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/15 via-sky-500/15 to-teal-500/15 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition duration-500 pointer-events-none" />
          
          <div className="relative backdrop-blur-2xl bg-white/80 border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">智慧轉帳建議與結算看板</h2>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold tracking-wider">
                ACTIVE
              </span>
            </div>

            {/* Settlements */}
            <div className="mb-10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">最佳轉帳路徑（最小化交易次數）</h3>
              {members.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                  請先在下方新增成員，即可自動計算最佳轉帳路徑。
                </div>
              ) : settlements.length === 0 ? (
                <div className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  所有款項已結清，帳目完全平衡 ✨
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-indigo-300 transition-all shadow-2xs group/card">
                      <div className="flex items-center gap-3 font-semibold text-slate-800">
                        <span className="px-3 py-1 rounded-xl bg-indigo-100/70 border border-indigo-200 text-indigo-800 text-sm font-bold">{s.from}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover/card:text-indigo-600 transition-colors" />
                        <span className="px-3 py-1 rounded-xl bg-sky-100/70 border border-sky-200 text-sky-800 text-sm font-bold">{s.to}</span>
                      </div>
                      <span className="text-lg font-black bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                        {currency} {s.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Personal Balance Overview */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">個人收支淨額總覽</h3>
              {members.length === 0 ? (
                <div className="text-xs text-slate-400">尚無成員資料</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {members.map(m => {
                    const net = netBalances[m.name] || 0;
                    const isPositive = net > 0.01;
                    const isNegative = net < -0.01;
                    return (
                      <div key={m.id} className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200 text-center shadow-2xs hover:border-slate-300 transition-all">
                        <div className="font-bold text-slate-900 mb-1 truncate text-base">{m.name}</div>
                        <div className={`text-base font-black ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'}`}>
                          {isPositive ? `+${currency} ${net.toLocaleString()}` : `${currency} ${net.toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-extrabold">
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
          
          {/* Member Management (Fixed button overflow with well-spaced flex wrap) */}
          <div className="backdrop-blur-2xl bg-white/80 border border-slate-200/90 rounded-3xl p-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">成員管理</h3>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold">{members.length} 位成員</span>
              </div>

              {/* Fixed: flex-col on mobile, sm:flex-row with clean spacing to prevent container overflow */}
              <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2.5 mb-6">
                <input
                  type="text"
                  placeholder="輸入成員姓名..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white px-5 py-3 rounded-2xl text-sm font-extrabold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>
              {errorMsg && <p className="text-xs font-semibold text-rose-600 mb-4">{errorMsg}</p>}

              <div className="flex flex-wrap gap-2.5">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">尚未新增成員，請在上方輸入。</p>
                ) : (
                  members.map(m => (
                    <div
                      key={m.id}
                      className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 hover:border-slate-300 transition-all shadow-2xs"
                    >
                      <span>{m.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(m.name)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                        title="刪除成員"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-200 text-xs text-slate-500 leading-relaxed font-medium">
              💡 提示：點擊成員右側刪除按鈕即可移除未參與記帳的成員。
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="backdrop-blur-2xl bg-white/80 border border-slate-200/90 rounded-3xl p-8 shadow-xl lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">新增支出記錄</h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">支出項目名稱</label>
                  <input
                    type="text"
                    placeholder="例如：晚餐、計程車、門票"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    金額 ({currency}) <span className="text-[11px] text-indigo-600 font-semibold lowercase">支援算式 150*2+60</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="例如 150*2+60 或 800/4"
                      value={rawAmountExpr}
                      onChange={(e) => setRawAmountExpr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-4 pr-24 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                      = {previewAmount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">付款人 (誰先付錢)</label>
                  <select
                    value={selectedPayer}
                    onChange={(e) => setSelectedPayer(e.target.value)}
                    aria-label="選擇付款人"
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {members.length === 0 ? (
                      <option value="">請先新增成員</option>
                    ) : (
                      members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">分攤人 (誰要一起出)</label>
                    <div className="space-x-3 text-xs font-extrabold">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong(members.map(m => m.name))}
                        className="text-indigo-600 hover:underline"
                      >
                        全選
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong([])}
                        className="text-rose-600 hover:underline"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3 flex flex-wrap gap-2.5 min-h-[52px] max-h-32 overflow-y-auto">
                    {members.length === 0 ? (
                      <span className="text-xs text-slate-400 italic self-center">請先新增成員</span>
                    ) : (
                      members.map(m => {
                        const isChecked = selectedSplitAmong.includes(m.name);
                        return (
                          <label
                            key={m.id}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                              isChecked ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs' : 'bg-white text-slate-600 border border-slate-200'
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
                              className="rounded text-indigo-600 focus:ring-0 w-4 h-4 border-slate-300"
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
                  className="bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 hover:opacity-95 text-white px-8 py-3.5 rounded-2xl text-sm font-black transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                >
                  <Plus className="w-4.5 h-4.5" />
                  新增支出項目
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* D. Expense Details List */}
        <div className="backdrop-blur-2xl bg-white/80 border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <Receipt className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">支出明細列表</h2>
            </div>
            <span className="text-xs px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-extrabold">
              共 {expenses.length} 筆記錄
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">目前尚無任何支出記錄</p>
              <p className="text-xs text-slate-400 mt-1">請先新增成員並在上方建立您的第一筆分帳紀錄。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {expenses.map(exp => (
                <div key={exp.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between shadow-2xs group">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-lg text-slate-900 group-hover:text-indigo-700 transition-colors">{exp.title}</h4>
                      <span className="text-lg font-black bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                        {currency} {exp.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mb-4 font-semibold">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-100/70 border border-indigo-200 text-indigo-900 font-extrabold">
                        付款人: {exp.payer}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>分攤人數: {exp.splitAmong.length} 人</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-400">{exp.createdAt}</span>
                    </div>

                    <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 mb-4 truncate font-semibold">
                      分攤成員: {exp.splitAmong.join(', ')}
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-extrabold transition-colors"
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
      <footer className="border-t border-slate-200 bg-white py-10 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-2">
          <p className="font-bold text-slate-700 text-sm">分帳專家 Split Expert · Vibrant Light Edition</p>
          <p>© {2026} 內建最小化貪婪結算演算法與即時本地持久化。</p>
        </div>
      </footer>
    </div>
  );
}
