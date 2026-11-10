import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@dss-monorepo/design-system';

export function ReportPageHeader({
  title,
  description,
  parent,
}: {
  title: string;
  description: string;
  parent?: { label: string; href: string };
}) {
  return (
    <header className="space-y-4">
      <Breadcrumb aria-label="Ruta de navegación">
        <BreadcrumbList className="text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Resumen</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {parent && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink href={parent.href}>
                  {parent.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="space-y-2 border-b border-border pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  );
}
