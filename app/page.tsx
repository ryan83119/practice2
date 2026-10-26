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
  Heart,
  ChevronRight
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
  // State initialization with localStorage persistence
  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
  ]);
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: 'e1',
      title: '晚餐聚餐',
      amount: 60,
      rawExpr: '60',
      payer: 'A',
      splitAmong: ['A', 'B', 'C'],
      createdAt: '今天 18:30',
    },
    {
      id: 'e2',
      title: '計程車費',
      amount: 40,
      rawExpr: '40',
      payer: 'B',
      splitAmong: ['B', 'C'],
      createdAt: '今天 19:15',
    },
  ]);
  const [currency, setCurrency] = useState('NT$');
  const [newMemberName, setNewMemberName] = useState('');
  
  // New Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [rawAmountExpr, setRawAmountExpr] = useState('');
  const [selectedPayer, setSelectedPayer] = useState('A');
  const [selectedSplitAmong, setSelectedSplitAmong] = useState<string[]>(['A', 'B', 'C']);
  const [errorMsg, setErrorMsg] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedMembers = localStorage.getItem('split_expert_members');
      const savedExpenses = localStorage.getItem('split_expert_expenses');
      const savedCurrency = localStorage.getItem('split_expert_currency');
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
      localStorage.setItem('split_expert_members', JSON.stringify(members));
      localStorage.setItem('split_expert_expenses', JSON.stringify(expenses));
      localStorage.setItem('split_expert_currency', JSON.stringify(currency));
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
      // If split is empty, default to all
      if (selectedSplitAmong.length === 0) {
        setSelectedSplitAmong(members.map(m => m.name));
      }
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
      setMembers([
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
        { id: '3', name: 'C' },
      ]);
      setExpenses([
        {
          id: 'e1',
          title: '晚餐聚餐',
          amount: 60,
          rawExpr: '60',
          payer: 'A',
          splitAmong: ['A', 'B', 'C'],
          createdAt: '今天 18:30',
        },
        {
          id: 'e2',
          title: '計程車費',
          amount: 40,
          rawExpr: '40',
          payer: 'B',
          splitAmong: ['B', 'C'],
          createdAt: '今天 19:15',
        },
      ]);
      localStorage.clear();
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
    <div className="min-h-screen bg-[#fcfbf9] text-[#2c302e] font-sans antialiased selection:bg-[#e3ded5]">
      {/* Navigation / Header */}
      <header className="border-b border-[#e8e4dc] bg-[#f7f5ef]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d4b2a7]/20 border border-[#d4b2a7]/40 flex items-center justify-center text-[#9c6658]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-[#4a453f]">分帳專家</span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-[#e3dec3]/50 text-[#606652] font-medium">
                Morandi Edition
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="選擇幣別"
              className="text-xs sm:text-sm bg-white border border-[#d8d2c6] rounded-lg px-2.5 py-1.5 text-[#555] font-medium focus:outline-none focus:ring-1 focus:ring-[#9c6658]"
            >
              {CURRENCIES.map(c => (
                <option key={c.symbol} value={c.symbol}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-[#7a6f66] hover:text-[#4a453f] bg-white border border-[#d8d2c6] hover:border-[#b8af9f] px-3 py-1.5 rounded-lg transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">重新開始</span>
            </button>
          </div>
        </div>
      </header>

      {/* Landing Page Hero Banner */}
      <section className="bg-gradient-to-b from-[#f7f5ef] to-[#fcfbf9] py-12 sm:py-16 px-4 sm:px-6 border-b border-[#ede8e0]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e3ded3]/60 border border-[#d4cfc2] text-[#5c6150] text-xs font-semibold mb-6 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#858b73]" />
            智能分帳與最小轉帳次數演算法
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#3d3832] mb-4">
            聚餐、旅行帳目，<span className="text-[#9c6658]">一指輕鬆搞定</span>
          </h1>
          <p className="text-base sm:text-lg text-[#71685e] max-w-2xl mx-auto mb-8 leading-relaxed">
            告別複雜的手工計算與混亂的零錢找還。自動計算個人淨額，透過貪婪演算法將轉帳次數降到最少，讓每一次聚會都充滿溫暖與輕鬆。
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-xs sm:text-sm text-[#61584e]">
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-[#e5dfd5] shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-[#7b856b]" />
              <span>零壓力即時結算</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-[#e5dfd5] shadow-2xs">
              <Calculator className="w-4 h-4 text-[#9c6658]" />
              <span>支援四則運算輸入</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-[#e5dfd5] shadow-2xs">
              <Heart className="w-4 h-4 text-[#c29b8c]" />
              <span>溫馨莫蘭迪美學</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        
        {/* A. 頂部看板 (即時結算區 - 最顯眼位置) */}
        <section className="bg-white border border-[#e5dfd5] rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#e3ded3]/30 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e3dec3]/60 flex items-center justify-center text-[#606652]">
                <Wallet className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#3d3832]">最佳轉帳建議與結算看板</h2>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#f0eee6] text-[#71685e] font-medium">
              即時同步計算
            </span>
          </div>

          {/* Settlements */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a7f73] mb-3">最佳轉帳路徑（最小化交易次數）</h3>
            {settlements.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-6 rounded-xl bg-[#f7f5ef] border border-dashed border-[#d8d2c6] text-[#635b52] font-medium text-sm">
                <CheckCircle2 className="w-5 h-5 text-[#7b856b]" />
                所有款項已結清 🎉
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {settlements.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-[#fdfbf7] border border-[#e8e2d5] shadow-2xs hover:border-[#d4c8b8] transition-all">
                    <div className="flex items-center gap-2.5 font-medium text-[#4a453f]">
                      <span className="px-2.5 py-1 rounded-md bg-[#eadecf] text-[#635b52] text-sm font-bold">{s.from}</span>
                      <ArrowRight className="w-4 h-4 text-[#a39788]" />
                      <span className="px-2.5 py-1 rounded-md bg-[#dce2db] text-[#4a5548] text-sm font-bold">{s.to}</span>
                    </div>
                    <span className="text-base font-extrabold text-[#9c6658]">
                      {currency} {s.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal Balance Overview */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a7f73] mb-3">個人收支淨額總覽</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {members.map(m => {
                const net = netBalances[m.name] || 0;
                const isPositive = net > 0.01;
                const isNegative = net < -0.01;
                return (
                  <div key={m.id} className="p-3.5 rounded-xl bg-[#faf8f5] border border-[#e8e2d5] text-center">
                    <div className="font-bold text-[#4a453f] mb-1 truncate">{m.name}</div>
                    <div className={`text-sm font-extrabold ${isPositive ? 'text-[#5a7356]' : isNegative ? 'text-[#b85c4f]' : 'text-[#8a7f73]'}`}>
                      {isPositive ? `+${currency} ${net.toLocaleString()}` : `${currency} ${net.toLocaleString()}`}
                    </div>
                    <div className="text-[10px] text-[#9c9185] mt-0.5">
                      {isPositive ? '實收 / 應拿回' : isNegative ? '需支付' : '已平衡'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Grid Section: Member Management & Add Expense Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* B. 成員管理區 */}
          <section className="bg-white border border-[#e5dfd5] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#7b856b]" />
                  <h3 className="font-bold text-[#3d3832]">成員管理</h3>
                </div>
                <span className="text-xs text-[#8a7f73]">{members.length} 位成員</span>
              </div>

              <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="輸入成員名稱..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 bg-[#fdfbf7] border border-[#d8d2c6] rounded-xl px-3 py-2 text-sm text-[#4a453f] placeholder-[#a39788] focus:outline-none focus:ring-1 focus:ring-[#9c6658]"
                />
                <button
                  type="submit"
                  className="bg-[#606652] hover:bg-[#4f5443] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>
              {errorMsg && <p className="text-xs text-[#b85c4f] mb-3">{errorMsg}</p>}

              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <div
                    key={m.id}
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f7f5ef] border border-[#e0dad0] text-sm font-medium text-[#4a453f] hover:border-[#b8af9f] transition-all"
                  >
                    <span>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(m.name)}
                      className="text-[#a39788] hover:text-[#b85c4f] transition-colors p-0.5"
                      title="刪除成員"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#f0ece4] text-xs text-[#8a7f73] leading-relaxed">
              💡 提示：點擊成員右側的刪除按鈕即可移除尚未參與記帳的成員。
            </div>
          </section>

          {/* C. 新增支出表單 (核心操作) */}
          <section className="bg-white border border-[#e5dfd5] rounded-2xl p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-[#9c6658]" />
              <h3 className="font-bold text-[#3d3832]">新增支出記錄</h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a6f66] mb-1.5">支出項目名稱</label>
                  <input
                    type="text"
                    placeholder="例如：晚餐、計程車、門票"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full bg-[#fdfbf7] border border-[#d8d2c6] rounded-xl px-3.5 py-2.5 text-sm text-[#4a453f] placeholder-[#a39788] focus:outline-none focus:ring-1 focus:ring-[#9c6658]"
                  />
                </div>

                {/* Amount with arithmetic expression parser */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a6f66] mb-1.5">
                    金額 ({currency}) <span className="text-[10px] text-[#9c6658] font-normal">支援算式如 150*2+60</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="例如 150*2+60 或 800/4"
                      value={rawAmountExpr}
                      onChange={(e) => setRawAmountExpr(e.target.value)}
                      className="w-full bg-[#fdfbf7] border border-[#d8d2c6] rounded-xl pl-3.5 pr-20 py-2.5 text-sm text-[#4a453f] placeholder-[#a39788] focus:outline-none focus:ring-1 focus:ring-[#9c6658]"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7b856b]">
                      = {previewAmount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payer */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a6f66] mb-1.5">付款人 (誰先付錢)</label>
                  <select
                    value={selectedPayer}
                    onChange={(e) => setSelectedPayer(e.target.value)}
                    aria-label="選擇付款人"
                    className="w-full bg-[#fdfbf7] border border-[#d8d2c6] rounded-xl px-3.5 py-2.5 text-sm text-[#4a453f] focus:outline-none focus:ring-1 focus:ring-[#9c6658]"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Split Among */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#7a6f66]">分攤人 (誰要一起出)</label>
                    <div className="space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong(members.map(m => m.name))}
                        className="text-[#606652] hover:underline font-medium"
                      >
                        全選
                      </button>
                      <span className="text-[#d8d2c6]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong([])}
                        className="text-[#9c6658] hover:underline font-medium"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#fdfbf7] border border-[#d8d2c6] rounded-xl p-2.5 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {members.map(m => {
                      const isChecked = selectedSplitAmong.includes(m.name);
                      return (
                        <label
                          key={m.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isChecked ? 'bg-[#e3dec3]/70 text-[#4f5443] border border-[#c9c4b2]' : 'bg-white text-[#8a7f73] border border-[#e0dad0]'
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
                            className="rounded text-[#606652] focus:ring-0 w-3.5 h-3.5"
                          />
                          {m.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-[#9c6658] hover:bg-[#855448] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新增支出項目
                </button>
              </div>
            </form>
          </section>

        </div>

        {/* D. 支出明細列表 */}
        <section className="bg-white border border-[#e5dfd5] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#d4b2a7]/20 flex items-center justify-center text-[#9c6658]">
                <Receipt className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#3d3832]">支出明細列表</h2>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#f0eee6] text-[#71685e] font-medium">
              共 {expenses.length} 筆記錄
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-12 text-[#9c9185] bg-[#faf8f5] rounded-xl border border-dashed border-[#e0dad0]">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">目前尚無任何支出記錄，請透過上方表單新增。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenses.map(exp => (
                <div key={exp.id} className="p-4 rounded-xl bg-[#fdfbf7] border border-[#e8e2d5] hover:border-[#d4c8b8] transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-base text-[#3d3832]">{exp.title}</h4>
                      <span className="text-base font-extrabold text-[#9c6658]">
                        {currency} {exp.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#71685e] mb-3">
                      <span className="px-2 py-0.5 rounded-md bg-[#eadecf] text-[#5c5044] font-medium">
                        付費者: {exp.payer}
                      </span>
                      <span className="text-[#b8af9f]">|</span>
                      <span>分攤人數: {exp.splitAmong.length} 人</span>
                      <span className="text-[#b8af9f]">|</span>
                      <span className="text-[#9c9185]">{exp.createdAt}</span>
                    </div>

                    <div className="text-xs text-[#8a7f73] bg-white border border-[#ede7dc] rounded-lg px-2.5 py-1.5 mb-3 truncate">
                      分攤成員: {exp.splitAmong.join(', ')}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-[#f0ece4]">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="flex items-center gap-1 text-xs text-[#b85c4f] hover:text-[#9c4a3f] font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      刪除記錄
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e4dc] bg-[#f7f5ef] py-8 text-center text-xs text-[#8a7f73]">
        <div className="max-w-5xl mx-auto px-4 space-y-2">
          <p className="font-medium text-[#5c5044]">分帳專家 Split Expert · 溫暖無壓力的團體帳目管理者</p>
          <p>© {2026} 內建最小化貪婪結算演算法與即時本地持久化。</p>
        </div>
      </footer>
    </div>
  );
}
