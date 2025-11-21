import { contractsService } from "@/lib/services/contractsService";
import { createPolicyAction, deletePolicyAction, createExampleAction, deleteExampleAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export default async function PoliciesPage() {
  const policies = await contractsService.listPolicies();
  const examples = await contractsService.listExampleAgreements();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-8 pb-24">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Policy Management</h1>
          <p className="text-muted-foreground">
            Define the rules and examples that guide the AI contract generation and review process.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Policy Rules Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Governance Rules</CardTitle>
                <CardDescription>
                  Simple statements about what your contracts must contain (e.g., "Payment terms are Net 30").
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={createPolicyAction} className="flex gap-2">
                  <Input 
                    name="description" 
                    placeholder="Add a new policy rule..." 
                    required 
                    minLength={5}
                  />
                  <Button type="submit">Add</Button>
                </form>

                <div className="space-y-2">
                  {policies.map((policy) => (
                    <div 
                      key={policy.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md group"
                    >
                      <span className="text-sm">{policy.description}</span>
                      <form action={deletePolicyAction.bind(null, policy.id)}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  ))}
                  {policies.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active policies. Add one to get started.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Example Agreements Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Example Agreements</CardTitle>
                <CardDescription>
                  Upload or paste good examples of your contracts (MSA, SOW, NDA) for the AI to mimic.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form action={createExampleAction} className="space-y-4 border-b pb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" name="name" placeholder="e.g. Standard MSA 2024" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <select 
                        id="type" 
                        name="type" 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        <option value="MSA">MSA</option>
                        <option value="SOW">SOW</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea 
                      id="content" 
                      name="content" 
                      placeholder="Paste the full text of the agreement here..." 
                      className="min-h-[100px]"
                      required 
                      minLength={10}
                    />
                  </div>
                  <Button type="submit" className="w-full">Save Example</Button>
                </form>

                <div className="space-y-2">
                  {examples.map((example) => (
                    <div 
                      key={example.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{example.name}</span>
                        <span className="text-xs text-muted-foreground">{example.type}</span>
                      </div>
                      <form action={deleteExampleAction.bind(null, example.id)}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  ))}
                  {examples.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No examples saved.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
