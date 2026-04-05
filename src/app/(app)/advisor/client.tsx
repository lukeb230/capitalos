"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  User,
  Loader2,
  Zap,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Wrench,
  Check,
  X,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProposedAction {
  operation: "create" | "update" | "delete";
  entityType: string;
  id?: string;
  data?: Record<string, unknown>;
  description?: string;
}

interface StructuredResponse {
  summary: string;
  tradeoffs: string[];
  nextStep: string;
  proposedActions?: ProposedAction[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  structured?: StructuredResponse;
  actionsApplied?: boolean;
  actionsDismissed?: boolean;
}

const quickPrompts = [
  { text: "Can I afford a $1,500/month apartment?", icon: "🏠" },
  { text: "How much does a $500/mo car payment delay my goals?", icon: "🚗" },
  { text: "Should I increase investing or pay off debt first?", icon: "📊" },
  { text: "Add a $200/mo grocery budget increase", icon: "🛒" },
  { text: "Create a scenario: what if I move to Austin with $1,200 rent?", icon: "🏙️" },
  { text: "What if I buy a $30K car with $450/mo payments?", icon: "💰" },
];

interface Props {
  netWorth: number;
  cashFlow: number;
  savingsRate: number;
  hasApiKey: boolean;
}

function ActionIcon({ operation }: { operation: string }) {
  if (operation === "create") return <Plus className="h-3.5 w-3.5 text-emerald-600" />;
  if (operation === "update") return <Pencil className="h-3.5 w-3.5 text-blue-600" />;
  if (operation === "delete") return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

function describeAction(action: ProposedAction): string {
  if (action.description) return action.description;
  if (action.entityType === "scenario" && action.operation === "create" && action.data) {
    return `Create scenario: "${action.data.name}"`;
  }
  if (action.operation === "create" && action.data) {
    const name = action.data.name as string;
    return `Add new ${action.entityType}: ${name}`;
  }
  if (action.operation === "delete") {
    return `Remove ${action.entityType}`;
  }
  return `${action.operation} ${action.entityType}`;
}

function actionDetail(action: ProposedAction): string {
  if (action.entityType === "scenario" && action.data) {
    const changes = action.data.changes as Array<{ field: string; oldValue: string; newValue: string }> | undefined;
    if (changes) return `${changes.length} change${changes.length !== 1 ? "s" : ""}: ${action.data.description || ""}`;
    return action.data.description as string || "";
  }
  if (action.operation === "create" && action.data) {
    const parts: string[] = [];
    if (action.data.amount) parts.push(`$${action.data.amount}`);
    if (action.data.value) parts.push(`$${action.data.value}`);
    if (action.data.balance) parts.push(`$${action.data.balance} balance`);
    if (action.data.frequency) parts.push(action.data.frequency as string);
    if (action.data.monthlyContribution) parts.push(`$${action.data.monthlyContribution}/mo contribution`);
    if (action.data.interestRate) parts.push(`${action.data.interestRate}% APR`);
    if (action.data.growthRate) parts.push(`${action.data.growthRate}% growth`);
    if (action.data.category) parts.push(action.data.category as string);
    if (action.data.type) parts.push(action.data.type as string);
    return parts.join(" \u00b7 ");
  }
  if (action.operation === "update" && action.data) {
    return Object.entries(action.data)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return "";
}

export function AdvisorClient({ netWorth, cashFlow, savingsRate, hasApiKey }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: [...messagesRef.current, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.content || data.structured?.summary || "",
        structured: data.structured,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          structured: { summary: "Connection error occurred.", tradeoffs: [], nextStep: "Check your internet connection and try again.", proposedActions: [] },
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  async function applyActions(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg?.structured?.proposedActions?.length) return;
    if (!confirm("Apply these changes to your financial data?")) return;

    setExecuting(msgIndex);

    try {
      const res = await fetch("/api/advisor/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: msg.structured.proposedActions }),
      });

      const result = await res.json();

      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex ? { ...m, actionsApplied: true } : m
        )
      );

      if (result.success) {
        // Add a confirmation message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            structured: {
              summary: `Done! Applied ${result.appliedCount} change${result.appliedCount !== 1 ? "s" : ""} to your profile. Your dashboard and projections are now updated.`,
              tradeoffs: [],
              nextStep: "Check your Dashboard to see the impact of these changes.",
              proposedActions: [],
            },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            structured: {
              summary: `Applied ${result.appliedCount} of ${result.totalCount} changes. Some actions failed.`,
              tradeoffs: result.results.filter((r: { success: boolean; error?: string }) => !r.success).map((r: { error?: string }) => r.error || "Unknown error"),
              nextStep: "Review the errors and try again.",
              proposedActions: [],
            },
          },
        ]);
      }

      router.refresh();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          structured: { summary: "Failed to apply changes. Please try again.", tradeoffs: [], nextStep: "", proposedActions: [] },
        },
      ]);
    }

    setExecuting(null);
  }

  function dismissActions(msgIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, actionsDismissed: true } : m
      )
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] pt-2 md:pt-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">AI Advisor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ask questions about your finances — or ask me to make changes
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] flex-1 min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          {/* Status */}
          <Card className={hasApiKey ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/10" : "border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/10"}>
            <CardContent className="flex items-center gap-3 py-3">
              <Sparkles className={`h-5 w-5 ${hasApiKey ? "text-emerald-600" : "text-amber-600"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {hasApiKey ? "Claude AI Connected" : "AI Not Configured"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasApiKey
                    ? "Can answer questions AND make changes to your data (with your approval)"
                    : "Add ANTHROPIC_API_KEY to your environment variables to enable AI"}
                </p>
              </div>
              <Badge variant={hasApiKey ? "default" : "secondary"}>
                {hasApiKey ? "Live" : "Setup Needed"}
              </Badge>
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="font-medium mb-1">Ask me anything — or tell me to make changes</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    I can update your income, expenses, debts, assets, and goals. I&apos;ll always ask you to confirm first.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                    {quickPrompts.map((qp) => (
                      <button
                        key={qp.text}
                        onClick={() => sendMessage(qp.text)}
                        className="flex items-center gap-2 p-3 rounded-lg border text-left hover:bg-accent transition-colors text-xs"
                      >
                        <span className="text-base">{qp.icon}</span>
                        <span>{qp.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 h-8 w-8 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}

                  <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                    {msg.role === "user" ? (
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ) : msg.structured ? (
                      <div className="space-y-3">
                        {/* Summary */}
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                          <p className="text-sm">{msg.structured.summary}</p>
                        </div>

                        {/* Tradeoffs */}
                        {msg.structured.tradeoffs.length > 0 && (
                          <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3" />
                              Key Tradeoffs
                            </p>
                            {msg.structured.tradeoffs.map((t, j) => (
                              <div key={j} className="flex items-start gap-2 text-sm">
                                <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Next Step */}
                        {msg.structured.nextStep && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3">
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                              <CheckCircle className="h-3 w-3" />
                              Recommended Next Step
                            </p>
                            <p className="text-sm">{msg.structured.nextStep}</p>
                          </div>
                        )}

                        {/* Proposed Actions */}
                        {msg.structured.proposedActions && msg.structured.proposedActions.length > 0 && !msg.actionsApplied && !msg.actionsDismissed && (
                          <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl px-4 py-3 space-y-3">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              Proposed Changes ({msg.structured.proposedActions.length})
                            </p>

                            <div className="space-y-2">
                              {msg.structured.proposedActions.map((action, j) => (
                                <div key={j} className="flex items-start gap-2 bg-white dark:bg-card rounded-lg p-2.5 border">
                                  <ActionIcon operation={action.operation} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{describeAction(action)}</p>
                                    {actionDetail(action) && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{actionDetail(action)}</p>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                                    {action.operation}
                                  </Badge>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => applyActions(i)}
                                disabled={executing === i}
                              >
                                {executing === i ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                {executing === i ? "Applying..." : "Apply Changes"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => dismissActions(i)}
                                disabled={executing === i}
                              >
                                <X className="h-3.5 w-3.5 mr-1.5" />
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Applied confirmation */}
                        {msg.actionsApplied && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Changes applied</p>
                          </div>
                        )}

                        {/* Dismissed */}
                        {msg.actionsDismissed && (
                          <div className="bg-muted/50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <X className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Changes dismissed</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="rounded-full bg-foreground h-8 w-8 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-background" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or request a change..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {messages.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {quickPrompts.slice(0, 3).map((qp) => (
                    <button
                      key={qp.text}
                      onClick={() => sendMessage(qp.text)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border hover:bg-accent transition-colors text-muted-foreground"
                    >
                      {qp.icon} {qp.text.split(" ").slice(0, 5).join(" ")}...
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your Numbers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Net Worth</span>
                <span className={`text-sm font-bold ${netWorth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(netWorth)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Cash Flow</span>
                <span className={`text-sm font-bold ${cashFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(cashFlow)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Savings Rate</span>
                <span className={`text-sm font-bold ${savingsRate >= 20 ? "text-emerald-600" : "text-amber-500"}`}>
                  {savingsRate}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" />
                Try Asking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                "Add a $100/mo gym membership",
                "Increase my 401k to $750/mo",
                "Create a scenario: buy a $30K truck",
                "What if I move somewhere with $1K rent?",
                "Set a $25K down payment goal",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-accent transition-colors text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight className="h-3 w-3 flex-shrink-0" />
                  {q}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Powered by</p>
              <Badge variant="outline">Anthropic Claude</Badge>
              <p className="text-[10px] text-muted-foreground mt-2">
                Future: OpenClaw agent integration
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
