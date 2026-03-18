import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Cobertura = () => (
  <DashboardLayout>
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wide">Cobertura</p>
        <h1 className="text-3xl font-bold">Cobertura de ausencias</h1>
        <p className="text-sm text-muted-foreground">
          Acesse os modulos de diarias e hora extra para coberturas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Diarias</CardTitle>
            <CardDescription>
              Cadastro e acompanhamento das diarias temporarias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/cobertura/diarias">Acessar diarias</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hora extra</CardTitle>
            <CardDescription>
              Registro e acompanhamento de horas extras para cobertura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/cobertura/hora-extra">Acessar hora extra</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </DashboardLayout>
);

export default Cobertura;
