"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: string;
}

const avatarColors = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export function ProfilesClient({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(avatarColors[0]);
  const [loading, setLoading] = useState<string | null>(null);

  async function selectProfile(profileId: string) {
    setLoading(profileId);
    try {
      const res = await fetch("/api/profiles/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (!res.ok) throw new Error("Failed to switch profile");
      router.push("/");
      router.refresh();
    } catch {
      alert("Failed to switch profile. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function createProfile() {
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarColor: color }),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      const profile = await res.json();
      setOpen(false);
      setName("");
      // Set the profile cookie, then redirect to onboarding
      const switchRes = await fetch("/api/profiles/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      if (!switchRes.ok) throw new Error("Failed to switch to new profile");
      router.push("/onboarding");
      router.refresh();
    } catch {
      alert("Failed to create profile. Please try again.");
    }
  }

  async function deleteProfile(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this profile and all its data?")) return;
    try {
      const res = await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete profile");
      router.refresh();
    } catch {
      alert("Failed to delete profile. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">CapitalOS</h1>
          <p className="text-muted-foreground">Choose your profile to get started</p>
        </div>

        {/* Profile Cards */}
        <div className={profiles.length === 0 ? "flex justify-center mb-6" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6"}>
          {profiles.map((profile) => {
            const initials = profile.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card
                key={profile.id}
                className="cursor-pointer hover:border-foreground/30 hover:shadow-lg transition-all duration-200 group relative"
                onClick={() => selectProfile(profile.id)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: profile.avatarColor }}
                  >
                    {loading === profile.id ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      initials
                    )}
                  </div>
                  <p className="font-semibold">{profile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(profile.createdAt).toLocaleDateString()}
                  </p>

                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteProfile(e, profile.id)}
                    aria-label="Delete profile"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </CardContent>
              </Card>
            );
          })}

          {/* New Profile Card */}
          <Card
            className={`cursor-pointer border-dashed hover:border-foreground/30 hover:shadow-lg transition-all duration-200 ${profiles.length === 0 ? "w-64" : ""}`}
            onClick={() => setOpen(true)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold">New Profile</p>
              <p className="text-xs text-muted-foreground mt-1">Create a new profile</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Profile Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex, Jordan, Work..."
                  onKeyDown={(e) => e.key === "Enter" && createProfile()}
                  autoFocus
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-2">
                  {avatarColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full transition-all ${
                        color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={createProfile} disabled={!name.trim()}>
                Create Profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
